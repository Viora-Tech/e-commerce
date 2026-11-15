import {
  createDb,
  order,
  orderLine,
  outboxEvent,
  payment,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { updateShipmentTracking } from '../shipping/tracking-edit'
import { FulfilTooMany, fulfilAllLines, fulfilOrderLines, NothingToFulfil } from './fulfil'
import { undoPacked } from './undo-packed'
import { TrackingNumberOnAnotherOrder } from './waybill-owner'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function fulfilledEvents(orderId: string): Promise<number> {
  const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.type, 'order.fulfilled'))
  return rows.filter((r) => (r.payload as { orderId?: string }).orderId === orderId).length
}

/** An open order for 3 units; `paid` records the capture the way checkout would. */
async function seed(money: 'unpaid' | 'paid' = 'paid') {
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
      number: 1,
      status: 'open',
      paymentStatus: money,
      checkoutPaidAt: money === 'paid' ? new Date() : null,
      subtotalPaise: 300000,
      totalPaise: 300000,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(payment).values({
    storeId: s.id,
    orderId: o.id,
    provider: money === 'paid' ? 'razorpay' : 'cod',
    providerRef: `ref_${o.id}`,
    status: money === 'paid' ? 'captured' : 'pending',
    amountPaise: 300000,
  })
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
    expect(o?.status).toBe('open')
    expect(o?.fulfillmentStatus).toBe('partially_fulfilled')
    expect(await fulfilledEvents(orderId)).toBe(0)
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
    expect(o?.status).toBe('open')
    expect(o?.paymentStatus).toBe('paid')
    expect(o?.fulfillmentStatus).toBe('fulfilled')
    expect(await fulfilledEvents(orderId)).toBe(1)
    const [sh] = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    expect(sh?.waybill).toBe('AWB123')
    expect(sh?.provider).toBe('Delhivery')
  })

  it('packs an unpaid (cash on delivery) order without touching its payment status', async () => {
    const { storeId, orderId, lines } = await seed('unpaid')
    const picks = lines.map((l) => ({ lineId: l.id, quantity: l.quantity }))

    const result = await withStore(app, storeId, (tx) =>
      fulfilOrderLines({ tx, storeId }, { orderId, lines: picks }),
    )

    expect(result.complete).toBe(true)
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.status).toBe('open')
    expect(o?.paymentStatus).toBe('unpaid')
    expect(o?.fulfillmentStatus).toBe('fulfilled')
    expect(await fulfilledEvents(orderId)).toBe(1)
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

/** A second open, paid order for the same store and variant (the customer's next order). */
async function seedSecondOrder(storeId: string, variantId: string, number = 2) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      subtotalPaise: 100000,
      totalPaise: 100000,
    })
    .returning()
  if (!o) throw new Error('seed')
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
  return { orderId: o.id, line }
}

describe('a tracking number already on another order (#2462/#2464, 15 Nov 2026)', () => {
  it('refuses to pack the second order under the first order AWB and leaves both as they were', async () => {
    const a = await seed()
    const b = await seedSecondOrder(a.storeId, a.lines[0]?.variantId as string)
    const all = a.lines.map((l) => ({ lineId: l.id, quantity: l.quantity }))
    await withStore(app, a.storeId, (tx) =>
      fulfilOrderLines(
        { tx, storeId: a.storeId },
        { orderId: a.orderId, lines: all, courier: 'Delhivery', trackingNumber: 'AWB-SHARED' },
      ),
    )

    const refused = withStore(app, a.storeId, (tx) =>
      fulfilOrderLines(
        { tx, storeId: a.storeId },
        {
          orderId: b.orderId,
          lines: [{ lineId: b.line.id, quantity: 1 }],
          courier: 'Delhivery',
          trackingNumber: 'AWB-SHARED',
        },
      ),
    )
    await expect(refused).rejects.toBeInstanceOf(TrackingNumberOnAnotherOrder)
    await expect(refused).rejects.toThrow(
      'Tracking number AWB-SHARED is already on order #1. To send this order in the same box',
    )

    const rows = await owner.select().from(shipment).where(eq(shipment.waybill, 'AWB-SHARED'))
    expect(rows.map((r) => r.orderId)).toEqual([a.orderId])
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.id, b.line.id))
    expect(line?.fulfilledQuantity).toBe(0)
    const [first] = await owner.select().from(order).where(eq(order.id, a.orderId))
    expect(first?.fulfillmentStatus).toBe('fulfilled')
  })

  it('refuses the bulk "Mark as fulfilled" too', async () => {
    const a = await seed()
    const b = await seedSecondOrder(a.storeId, a.lines[0]?.variantId as string)
    await withStore(app, a.storeId, (tx) =>
      fulfilAllLines(
        { tx, storeId: a.storeId },
        { orderId: a.orderId, courier: 'Delhivery', trackingNumber: 'AWB-BULK' },
      ),
    )
    await expect(
      withStore(app, a.storeId, (tx) =>
        fulfilAllLines(
          { tx, storeId: a.storeId },
          { orderId: b.orderId, courier: 'Delhivery', trackingNumber: 'AWB-BULK' },
        ),
      ),
    ).rejects.toMatchObject({ code: 'TRACKING_NUMBER_ON_ANOTHER_ORDER', otherOrderNumber: 1 })
    const [row] = await owner.select().from(shipment).where(eq(shipment.waybill, 'AWB-BULK'))
    expect(row?.orderId).toBe(a.orderId)
  })

  it('says the number was used when the other order shipment is closed', async () => {
    const a = await seed()
    const b = await seedSecondOrder(a.storeId, a.lines[0]?.variantId as string)
    const all = a.lines.map((l) => ({ lineId: l.id, quantity: l.quantity }))
    await withStore(app, a.storeId, async (tx) => {
      await fulfilOrderLines(
        { tx, storeId: a.storeId },
        { orderId: a.orderId, lines: all, courier: 'Delhivery', trackingNumber: 'AWB-OLD' },
      )
      await undoPacked({ tx, storeId: a.storeId }, a.orderId)
    })
    await expect(
      withStore(app, a.storeId, (tx) =>
        fulfilOrderLines(
          { tx, storeId: a.storeId },
          {
            orderId: b.orderId,
            lines: [{ lineId: b.line.id, quantity: 1 }],
            courier: 'Delhivery',
            trackingNumber: 'AWB-OLD',
          },
        ),
      ),
    ).rejects.toThrow('Tracking number AWB-OLD was used on order #1.')
  })

  it('keeps one row when the same order packs again under its own AWB, live again after an undo', async () => {
    const { storeId, orderId, lines } = await seed()
    const [first, second] = lines
    if (!first || !second) throw new Error('seed')
    const pack = (lineId: string, quantity: number) =>
      withStore(app, storeId, (tx) =>
        fulfilOrderLines(
          { tx, storeId },
          {
            orderId,
            lines: [{ lineId, quantity }],
            courier: 'Delhivery',
            trackingNumber: 'AWB-OWN',
          },
        ),
      )
    const one = await pack(first.id, 2)
    const two = await pack(second.id, 1)
    expect(two.shipmentId).toBe(one.shipmentId)

    await withStore(app, storeId, (tx) => undoPacked({ tx, storeId }, orderId))
    const [closed] = await owner.select().from(shipment).where(eq(shipment.waybill, 'AWB-OWN'))
    expect(closed?.status).toBe('cancelled')
    const again = await pack(first.id, 2)
    expect(again.shipmentId).toBe(one.shipmentId)
    const [live] = await owner.select().from(shipment).where(eq(shipment.waybill, 'AWB-OWN'))
    expect(live?.status).toBe('created')
  })

  it('Edit tracking names the order that already has the number', async () => {
    const a = await seed()
    const b = await seedSecondOrder(a.storeId, a.lines[0]?.variantId as string)
    const all = a.lines.map((l) => ({ lineId: l.id, quantity: l.quantity }))
    const theirs = await withStore(app, a.storeId, async (tx) => {
      const ctx = { tx, storeId: a.storeId }
      await fulfilOrderLines(ctx, {
        orderId: a.orderId,
        lines: all,
        courier: 'Delhivery',
        trackingNumber: 'AWB-A',
      })
      return fulfilOrderLines(ctx, {
        orderId: b.orderId,
        lines: [{ lineId: b.line.id, quantity: 1 }],
        courier: 'Delhivery',
        trackingNumber: 'AWB-B',
      })
    })
    await expect(
      withStore(app, a.storeId, (tx) =>
        updateShipmentTracking(
          { tx, storeId: a.storeId },
          theirs.shipmentId as string,
          { waybill: 'AWB-A' },
          'owner@example.com',
        ),
      ),
    ).rejects.toThrow('Tracking number AWB-A is already on order #1.')
  })
})
