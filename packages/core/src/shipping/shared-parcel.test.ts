/** SOURCE OF TRUTH: tests for one box, several orders ("Same box as #A") — WHAT: choices, joining, tracking, delivered, RTO and leaving a shared box / WHY: #2462 and #2464 went out in one box (15 Nov 2026) */
import {
  createDb,
  customer,
  order,
  orderLine,
  outboxEvent,
  payment,
  product,
  returnRequest,
  type StoreTx,
  shipment,
  shipmentSharedOrder,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { ShipmentStatus } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fulfilOrderLines } from '../order/fulfil'
import { undoPacked } from '../order/undo-packed'
import { applyTracking } from './apply-tracking'
import { sameBoxChoices } from './shared-parcel'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

type Seeded = { orderId: string; lineId: string }

/** A paid open order for one unit, for this customer. */
async function seedOrder(
  storeId: string,
  variantId: string,
  customerId: string,
  number: number,
): Promise<Seeded> {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number,
      customerId,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      subtotalPaise: 100000,
      totalPaise: 100000,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(payment).values({
    storeId,
    orderId: o.id,
    provider: 'razorpay',
    providerRef: `ref_${o.id}`,
    status: 'captured',
    amountPaise: 100000,
  })
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId,
      orderId: o.id,
      variantId,
      title: 'Pad',
      quantity: 1,
      unitPricePaise: 100000,
    })
    .returning()
  if (!line) throw new Error('seed')
  return { orderId: o.id, lineId: line.id }
}

/** #2462 and #2464 of one customer, plus another customer's order; #2462 packed under an AWB. */
async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 100000 })
    .returning()
  const people = await owner
    .insert(customer)
    .values([
      { storeId: s.id, email: 'asha@example.com' },
      { storeId: s.id, email: 'ravi@example.com' },
    ])
    .returning()
  const [asha, ravi] = people
  if (!v || !asha || !ravi) throw new Error('seed')
  const a = await seedOrder(s.id, v.id, asha.id, 2462)
  const b = await seedOrder(s.id, v.id, asha.id, 2464)
  const c = await seedOrder(s.id, v.id, ravi.id, 2470)
  const packed = await withStore(app, s.id, (tx) =>
    fulfilOrderLines(
      { tx, storeId: s.id },
      {
        orderId: a.orderId,
        lines: [{ lineId: a.lineId, quantity: 1 }],
        courier: 'Delhivery',
        trackingNumber: 'DL123',
      },
    ),
  )
  return { storeId: s.id, a, b, c, boxId: packed.shipmentId as string }
}

const inStore = <T>(storeId: string, fn: (ctx: { tx: StoreTx; storeId: string }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ tx, storeId }))

const scan = (storeId: string, shipmentId: string, status: ShipmentStatus) =>
  inStore(storeId, (ctx) =>
    applyTracking(ctx, shipmentId, {
      waybill: 'DL123',
      status,
      events: [{ at: new Date().toISOString(), status, description: status }],
    }),
  )

const statusOf = async (orderId: string) => {
  const [o] = await owner.select().from(order).where(eq(order.id, orderId))
  return { status: o?.status, fulfillment: o?.fulfillmentStatus }
}

const eventsFor = async (type: string, orderId: string) =>
  (await owner.select().from(outboxEvent).where(eq(outboxEvent.type, type))).filter(
    (e) => (e.payload as { orderId?: string }).orderId === orderId,
  ).length

/** Packs B in A's box. */
const packInBox = (t: Awaited<ReturnType<typeof seed>>) =>
  inStore(t.storeId, (ctx) =>
    fulfilOrderLines(ctx, {
      orderId: t.b.orderId,
      lines: [{ lineId: t.b.lineId, quantity: 1 }],
      sameBoxAs: t.boxId,
    }),
  )

describe('Same box as #A (#2462/#2464, 15 Nov 2026)', () => {
  it('offers only the same customer’s live boxes', async () => {
    const t = await seed()
    const choices = await inStore(t.storeId, (ctx) => sameBoxChoices(ctx, t.b.orderId))
    expect(choices).toEqual([
      expect.objectContaining({
        shipmentId: t.boxId,
        orderNumber: 2462,
        waybill: 'DL123',
        courier: 'Delhivery',
      }),
    ])
    expect(await inStore(t.storeId, (ctx) => sameBoxChoices(ctx, t.c.orderId))).toEqual([])
    expect(await inStore(t.storeId, (ctx) => sameBoxChoices(ctx, t.a.orderId))).toEqual([])
  })

  it('packs the order into the box without a second shipment', async () => {
    const t = await seed()
    const r = await packInBox(t)
    expect(r.shipmentId).toBe(t.boxId)
    expect(await owner.select().from(shipment)).toHaveLength(1)
    const links = await owner.select().from(shipmentSharedOrder)
    expect(links.map((l) => [l.shipmentId, l.orderId])).toEqual([[t.boxId, t.b.orderId]])
    expect(await statusOf(t.b.orderId)).toEqual({ status: 'open', fulfillment: 'fulfilled' })
    expect(await eventsFor('order.fulfilled', t.b.orderId)).toBe(1)
    // The box is no longer offered to the order already in it.
    expect(await inStore(t.storeId, (ctx) => sameBoxChoices(ctx, t.b.orderId))).toEqual([])
  })

  it('refuses another customer’s box', async () => {
    const t = await seed()
    await expect(
      inStore(t.storeId, (ctx) =>
        fulfilOrderLines(ctx, {
          orderId: t.c.orderId,
          lines: [{ lineId: t.c.lineId, quantity: 1 }],
          sameBoxAs: t.boxId,
        }),
      ),
    ).rejects.toMatchObject({ code: 'SAME_BOX_REFUSED' })
    expect(await owner.select().from(shipmentSharedOrder)).toEqual([])
  })

  it('follows the box’s tracking and closes as delivered with it', async () => {
    const t = await seed()
    await packInBox(t)
    await scan(t.storeId, t.boxId, 'in_transit')
    expect((await statusOf(t.b.orderId)).fulfillment).toBe('shipped')
    await scan(t.storeId, t.boxId, 'out_for_delivery')
    expect(await eventsFor('shipment.out_for_delivery', t.b.orderId)).toBe(1)
    await scan(t.storeId, t.boxId, 'delivered')
    expect(await statusOf(t.a.orderId)).toEqual({ status: 'completed', fulfillment: 'delivered' })
    expect(await statusOf(t.b.orderId)).toEqual({ status: 'completed', fulfillment: 'delivered' })
    expect(await eventsFor('order.delivered', t.b.orderId)).toBe(1)
    expect(await eventsFor('order.delivered', t.a.orderId)).toBe(1)
  })

  it('opens an RTO task on each order when the box comes back', async () => {
    const t = await seed()
    await packInBox(t)
    await scan(t.storeId, t.boxId, 'rto')
    await scan(t.storeId, t.boxId, 'in_transit')
    await scan(t.storeId, t.boxId, 'rto')
    const tasks = await owner.select().from(returnRequest).where(eq(returnRequest.kind, 'rto'))
    expect(tasks.map((r) => r.orderId).sort()).toEqual([t.a.orderId, t.b.orderId].sort())
    expect((await statusOf(t.b.orderId)).fulfillment).toBe('returned')
  })

  it('"Mark as not shipped" on the order in the box takes it out', async () => {
    const t = await seed()
    await packInBox(t)
    const r = await inStore(t.storeId, (ctx) => undoPacked(ctx, t.b.orderId))
    expect(r).toEqual({ undone: true, units: 1 })
    expect(await owner.select().from(shipmentSharedOrder)).toEqual([])
    expect((await statusOf(t.b.orderId)).fulfillment).toBe('unfulfilled')
    expect((await statusOf(t.a.orderId)).fulfillment).toBe('fulfilled')
    const [box] = await owner.select().from(shipment)
    expect(box?.status).toBe('created')
  })

  it('"Mark as not shipped" on the order it was booked for empties the box', async () => {
    const t = await seed()
    await packInBox(t)
    await inStore(t.storeId, (ctx) => undoPacked(ctx, t.a.orderId))
    expect(await owner.select().from(shipmentSharedOrder)).toEqual([])
    expect((await statusOf(t.a.orderId)).fulfillment).toBe('unfulfilled')
    expect((await statusOf(t.b.orderId)).fulfillment).toBe('unfulfilled')
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.id, t.b.lineId))
    expect(line?.fulfilledQuantity).toBe(0)
  })
})
