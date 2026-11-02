/** SOURCE OF TRUTH: holdOrderByStaff, releaseOrderByStaff — tests holding, what a hold blocks, releasing, a second hold and cancelled orders */
import {
  createDb,
  fulfillmentOrder,
  order,
  orderLine,
  orderNote,
  outboxEvent,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fulfilOrderLines } from './fulfil'
import { FulfillmentOnHold, heldParcels } from './fulfillment-hold'
import { holdOrderByStaff, OrderNotHoldable, releaseOrderByStaff } from './staff-hold'
import { changeOrderStatus } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function events(type: string): Promise<number> {
  const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.type, type))
  return rows.length
}

/** An open, paid order for 2 units of one line. */
async function seed(status: 'open' | 'cancelled' = 'open') {
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
    .values({
      storeId: s.id,
      number: 7,
      status,
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      subtotalPaise: 200000,
      totalPaise: 200000,
    })
    .returning()
  if (!o) throw new Error('seed')
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId: s.id,
      orderId: o.id,
      variantId: v.id,
      title: 'Pad',
      quantity: 2,
      unitPricePaise: 100000,
    })
    .returning()
  if (!line) throw new Error('seed')
  return { storeId: s.id, orderId: o.id, lineId: line.id }
}

const AUTHOR = 'staff@waimers.in'

describe('holdOrderByStaff', () => {
  it('holds the parcels with the reason and who, and logs it on the timeline', async () => {
    const { storeId, orderId } = await seed()
    const held = await withStore(app, storeId, (tx) =>
      holdOrderByStaff(
        { tx, storeId },
        { orderId, reason: 'address_check', note: 'Pincode looks wrong', author: AUTHOR },
      ),
    )
    expect(held.length).toBeGreaterThan(0)
    const parcels = await withStore(app, storeId, (tx) => heldParcels(tx, orderId))
    expect(parcels[0]).toMatchObject({
      code: 'address_check',
      reason: 'Pincode looks wrong',
      heldBy: AUTHOR,
    })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => [n.body, n.author])).toEqual([
      ['Fulfilment put on hold: Address check: Pincode looks wrong', AUTHOR],
    ])
    expect(await events('order.fulfillment_held')).toBe(1)
  })

  it('refuses packing, "Mark as fulfilled" and "Mark as delivered" while held', async () => {
    const { storeId, orderId, lineId } = await seed()
    await withStore(app, storeId, (tx) =>
      holdOrderByStaff({ tx, storeId }, { orderId, reason: 'awaiting_stock', author: AUTHOR }),
    )
    await expect(
      withStore(app, storeId, (tx) =>
        fulfilOrderLines({ tx, storeId }, { orderId, lines: [{ lineId, quantity: 1 }] }),
      ),
    ).rejects.toThrow(FulfillmentOnHold)
    for (const mark of ['fulfilled', 'delivered'] as const) {
      await expect(
        withStore(app, storeId, (tx) => changeOrderStatus({ tx, storeId }, orderId, mark)),
      ).rejects.toThrow(/on hold \(Awaiting stock\)/)
    }
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.id, lineId))
    expect(line?.fulfilledQuantity).toBe(0)
  })

  it('releases back to the normal state, logged, and packing works again', async () => {
    const { storeId, orderId, lineId } = await seed()
    await withStore(app, storeId, (tx) =>
      holdOrderByStaff({ tx, storeId }, { orderId, reason: 'payment_check', author: AUTHOR }),
    )
    const released = await withStore(app, storeId, (tx) =>
      releaseOrderByStaff({ tx, storeId }, { orderId, author: AUTHOR }),
    )
    expect(released.length).toBeGreaterThan(0)
    const rows = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId))
    expect(rows.every((r) => r.heldAt === null && r.holdCode === null && r.heldBy === null)).toBe(
      true,
    )
    expect(await events('order.fulfillment_released')).toBe(1)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toContain('Fulfilment hold released')

    await withStore(app, storeId, (tx) =>
      fulfilOrderLines({ tx, storeId }, { orderId, lines: [{ lineId, quantity: 2 }] }),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.fulfillmentStatus).toBe('fulfilled')
  })

  it('refuses a second hold; releasing nothing writes nothing', async () => {
    const { storeId, orderId } = await seed()
    const hold = () =>
      withStore(app, storeId, (tx) =>
        holdOrderByStaff({ tx, storeId }, { orderId, reason: 'other', author: AUTHOR }),
      )
    await hold()
    await expect(hold()).rejects.toThrow(OrderNotHoldable)
    const none = await withStore(app, storeId, async (tx) => {
      await releaseOrderByStaff({ tx, storeId }, { orderId, author: AUTHOR })
      return releaseOrderByStaff({ tx, storeId }, { orderId, author: AUTHOR })
    })
    expect(none).toEqual([])
    expect(await events('order.fulfillment_released')).toBe(1)
  })

  it('refuses a cancelled order', async () => {
    const { storeId, orderId } = await seed('cancelled')
    await expect(
      withStore(app, storeId, (tx) =>
        holdOrderByStaff({ tx, storeId }, { orderId, reason: 'other', author: AUTHOR }),
      ),
    ).rejects.toThrow(OrderNotHoldable)
  })
})
