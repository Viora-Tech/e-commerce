import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import {
  fulfillmentOrder,
  fulfillmentOrderLine,
  inventoryLevel,
  location,
  order,
  orderLine,
  product,
  shipment,
  store,
  variant,
} from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0096 gives every placed order with goods its fulfilment orders (parcels). The tables already
 * exist here (global setup migrated), so only the statements after the BACKFILL marker run
 * again, against orders shaped as before 0096.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0096_fulfillment_orders.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

async function seedStore(slug: string) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}` })
    .returning()
  if (!s) throw new Error('seed')
  const [home] = await owner
    .insert(location)
    .values({ storeId: s.id, name: 'Home', isDefault: true, fulfilsOnlineOrders: true })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad' })
    .returning()
  if (!home || !p) throw new Error('seed')
  const [goods, card] = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p.id, title: 'Black', pricePaise: 1000 },
      { storeId: s.id, productId: p.id, title: 'Card', pricePaise: 1000 },
    ])
    .returning()
  if (!goods || !card) throw new Error('seed')
  await owner
    .insert(inventoryLevel)
    .values({ storeId: s.id, variantId: goods.id, locationId: home.id, onHand: 9 })
  return { storeId: s.id, homeId: home.id, goodsId: goods.id, cardId: card.id }
}

type Seeded = Awaited<ReturnType<typeof seedStore>>

async function seedOrder(
  t: Seeded,
  number: number,
  status: 'open' | 'cancelled' | 'draft' | 'completed',
  lines: { variantId: string; quantity: number; fulfilled?: number; giftCard?: boolean }[],
) {
  const [o] = await owner
    .insert(order)
    .values({ storeId: t.storeId, number, status, subtotalPaise: 1000, totalPaise: 1000 })
    .returning()
  if (!o) throw new Error('seed')
  if (lines.length) {
    await owner.insert(orderLine).values(
      lines.map((l) => ({
        storeId: t.storeId,
        orderId: o.id,
        variantId: l.variantId,
        quantity: l.quantity,
        unitPricePaise: 1000,
        fulfilledQuantity: l.fulfilled ?? 0,
        giftCard: l.giftCard ?? false,
      })),
    )
  }
  return o.id
}

async function parcels(orderId: string) {
  const fos = await owner
    .select()
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, orderId))
  const lines = await owner
    .select({
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
      giftCard: orderLine.giftCard,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
    .where(eq(orderLine.orderId, orderId))
  return { fos, lines }
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0096 backfill', () => {
  it('gives each placed order one parcel at the selling location, idempotently', async () => {
    const a = await seedStore('a')
    const open = await seedOrder(a, 1, 'open', [
      { variantId: a.goodsId, quantity: 3, fulfilled: 1 },
      { variantId: a.cardId, quantity: 1, giftCard: true },
    ])
    await runBackfill()
    await runBackfill()
    const { fos, lines } = await parcels(open)
    expect(fos).toEqual([
      expect.objectContaining({ storeId: a.storeId, locationId: a.homeId, position: 1 }),
    ])
    expect(fos[0]?.status).toBe('open')
    // Gift cards are vouchers: no parcel line.
    expect(lines).toEqual([
      { fulfillmentOrderId: fos[0]?.id, quantity: 3, fulfilledQuantity: 1, giftCard: false },
    ])
  })

  it('derives the parcel status from the order and its packing', async () => {
    const a = await seedStore('a')
    const packed = await seedOrder(a, 1, 'completed', [
      { variantId: a.goodsId, quantity: 2, fulfilled: 2 },
    ])
    const cancelled = await seedOrder(a, 2, 'cancelled', [{ variantId: a.goodsId, quantity: 2 }])
    await runBackfill()
    expect((await parcels(packed)).fos[0]?.status).toBe('fulfilled')
    expect((await parcels(cancelled)).fos[0]?.status).toBe('cancelled')
  })

  it('skips drafts and orders with only gift cards', async () => {
    const a = await seedStore('a')
    const draft = await seedOrder(a, 1, 'draft', [{ variantId: a.goodsId, quantity: 1 }])
    const cards = await seedOrder(a, 2, 'open', [
      { variantId: a.cardId, quantity: 1, giftCard: true },
    ])
    await runBackfill()
    expect((await parcels(draft)).fos).toHaveLength(0)
    expect((await parcels(cards)).fos).toHaveLength(0)
  })

  it('untracked goods with no inventory row go to the default location', async () => {
    const a = await seedStore('a')
    const o = await seedOrder(a, 1, 'open', [{ variantId: a.cardId, quantity: 2 }])
    await runBackfill()
    expect((await parcels(o)).fos[0]?.locationId).toBe(a.homeId)
  })

  it('keeps stores apart and links a one-parcel order’s shipments', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const oa = await seedOrder(a, 1, 'open', [{ variantId: a.goodsId, quantity: 1 }])
    const ob = await seedOrder(b, 1, 'open', [{ variantId: b.goodsId, quantity: 1 }])
    await owner
      .insert(shipment)
      .values({ storeId: a.storeId, orderId: oa, provider: 'manual', waybill: 'W1' })
    await runBackfill()
    const pa = await parcels(oa)
    const pb = await parcels(ob)
    expect(pa.fos[0]?.storeId).toBe(a.storeId)
    expect(pb.fos[0]?.storeId).toBe(b.storeId)
    expect(pb.fos[0]?.locationId).toBe(b.homeId)
    const [ship] = await owner.select().from(shipment).where(eq(shipment.orderId, oa))
    expect(ship?.fulfillmentOrderId).toBe(pa.fos[0]?.id)
  })
})
