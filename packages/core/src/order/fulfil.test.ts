import {
  createDb,
  order,
  orderLine,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { FulfilTooMany, fulfilOrderLines, NothingToFulfil } from './fulfil'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed(status: 'placed' | 'paid' = 'paid') {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Default', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({ storeId: s.id, number: 1, status, subtotalPaise: 300000, totalPaise: 300000 })
    .returning()
  if (!o) throw new Error('seed')
  const lines = await owner
    .insert(orderLine)
    .values([
      {
        storeId: s.id,
        orderId: o.id,
        variantId: v.id,
        title: 'Pad',
        quantity: 2,
        unitPricePaise: 100000,
      },
      {
        storeId: s.id,
        orderId: o.id,
        variantId: v.id,
        title: 'Pad blue',
        quantity: 1,
        unitPricePaise: 100000,
      },
    ])
    .returning()
  return { storeId: s.id, orderId: o.id, lines }
}

describe('fulfilOrderLines', () => {
  it('packs part of an order without finishing it', async () => {
    const { storeId, orderId, lines } = await seed()
    const first = lines[0]
    if (!first) throw new Error('seed')

    const result = await withStore(app, storeId, (tx) =>
      fulfilOrderLines({ tx, storeId }, { orderId, lines: [{ lineId: first.id, quantity: 1 }] }),
    )

    expect(result.complete).toBe(false)
    expect(result.shipmentId).toBeNull()
    const [row] = await owner.select().from(orderLine).where(eq(orderLine.id, first.id))
    expect(row?.fulfilledQuantity).toBe(1)
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.status).toBe('paid')
  })

  it('marks a paid order fulfilled and records the tracking number once everything is packed', async () => {
    const { storeId, orderId, lines } = await seed()
    const picks = lines.map((l) => ({ lineId: l.id, quantity: l.quantity }))

    const result = await withStore(app, storeId, (tx) =>
      fulfilOrderLines(
        { tx, storeId },
        { orderId, lines: picks, courier: 'Delhivery', trackingNumber: 'AWB123' },
      ),
    )

    expect(result.complete).toBe(true)
    expect(result.shipmentId).not.toBeNull()
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.status).toBe('fulfilled')
    const [sh] = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    expect(sh?.waybill).toBe('AWB123')
    expect(sh?.provider).toBe('Delhivery')
  })

  it('leaves an unpaid order alone so cash on delivery still shows as placed', async () => {
    const { storeId, orderId, lines } = await seed('placed')
    const picks = lines.map((l) => ({ lineId: l.id, quantity: l.quantity }))

    const result = await withStore(app, storeId, (tx) =>
      fulfilOrderLines({ tx, storeId }, { orderId, lines: picks }),
    )

    expect(result.complete).toBe(true)
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.status).toBe('placed')
  })

  it('refuses more than was ordered, and an empty pick', async () => {
    const { storeId, orderId, lines } = await seed()
    const first = lines[0]
    if (!first) throw new Error('seed')

    await expect(
      withStore(app, storeId, (tx) =>
        fulfilOrderLines({ tx, storeId }, { orderId, lines: [{ lineId: first.id, quantity: 5 }] }),
      ),
    ).rejects.toBeInstanceOf(FulfilTooMany)

    await expect(
      withStore(app, storeId, (tx) => fulfilOrderLines({ tx, storeId }, { orderId, lines: [] })),
    ).rejects.toBeInstanceOf(NothingToFulfil)
  })
})
