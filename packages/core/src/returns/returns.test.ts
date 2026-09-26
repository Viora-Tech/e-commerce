/** SOURCE OF TRUTH: returns and RTO tests — eligibility, the request-to-refund flow, restock, store credit, exchange, RTO task, re-ship, RLS */
import {
  address,
  createDb,
  customer,
  giftCard,
  inventoryAdjustment,
  inventoryLevel,
  order,
  orderLine,
  outboxEvent,
  payment,
  product,
  refund,
  returnRequest,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider, type Tracking } from '@commerce/shipping'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { applyTracking, createShipmentForOrder } from '../shipping/shipments'
import {
  defaultReturnPolicy,
  parseReturnPolicy,
  returnActions,
  returnEligibility,
  returnTimeline,
} from './policy'
import { exchangeReturn, refundReturn, reshipReturn, storeCreditReturn } from './resolve'
import { rtoSummary } from './rto'
import {
  approveReturn,
  arrangeReturnPickup,
  getReturn,
  listReturns,
  orderReturnState,
  receiveReturn,
  rejectReturn,
  requestReturn,
  restockReturn,
  saveReturnPolicy,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY = 86_400_000

describe('returnEligibility (pure)', () => {
  const lines = [
    { id: 'a', quantity: 2, fulfilledQuantity: 2, giftCard: false },
    { id: 'g', quantity: 1, fulfilledQuantity: 1, giftCard: true },
  ]
  const base = {
    policy: defaultReturnPolicy,
    status: 'completed',
    lines,
    alreadyReturning: new Map<string, number>(),
  }

  it('opens for the window after delivery, never for gift cards', () => {
    const e = returnEligibility({
      ...base,
      deliveredAt: new Date('2026-09-01T00:00:00Z'),
      now: new Date('2026-09-03T00:00:00Z'),
    })
    expect(e.open).toBe(true)
    expect(e.daysLeft).toBe(5)
    expect(e.lines).toEqual([
      { lineId: 'a', returnable: 2, why: 'ok' },
      { lineId: 'g', returnable: 0, why: 'gift_card' },
    ])
  })

  it('closes before delivery, after the window, when disabled or all returning', () => {
    const at = new Date('2026-09-01T00:00:00Z')
    expect(returnEligibility({ ...base, deliveredAt: null, now: at }).why).toBe('not_delivered')
    expect(
      returnEligibility({ ...base, deliveredAt: at, now: new Date(at.getTime() + 8 * DAY) }).why,
    ).toBe('window_closed')
    expect(
      returnEligibility({
        ...base,
        policy: { ...defaultReturnPolicy, enabled: false },
        deliveredAt: at,
        now: at,
      }).why,
    ).toBe('disabled')
    expect(
      returnEligibility({
        ...base,
        alreadyReturning: new Map([['a', 2]]),
        deliveredAt: at,
        now: at,
      }).why,
    ).toBe('nothing_left')
  })

  it('parses a bad policy to the defaults and keeps reasons in list order', () => {
    expect(parseReturnPolicy('nonsense')).toEqual(defaultReturnPolicy)
    expect(parseReturnPolicy({ reasons: ['other', 'damaged'] }).reasons).toEqual([
      'damaged',
      'other',
    ])
  })

  it('builds the timeline and next actions', () => {
    const t = {
      status: 'rejected' as const,
      kind: 'return' as const,
      pickupMethod: null,
      requestedAt: new Date(),
      approvedAt: null,
      rejectedAt: new Date(),
      pickupArrangedAt: null,
      receivedAt: null,
      resolvedAt: null,
    }
    expect(returnTimeline(t).map((s) => s.key)).toEqual(['requested', 'rejected'])
    expect(returnTimeline({ ...t, status: 'approved' }).map((s) => s.done)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    expect(returnTimeline({ ...t, kind: 'rto', status: 'received' })[0]?.key).toBe('received')
    expect(returnActions({ status: 'received', kind: 'rto', restockedAt: null })).toMatchObject({
      approve: false,
      resolve: true,
      restock: true,
    })
  })
})

let orderNumber = 0

async function seed(opts: { delivered?: Date | null; paid?: boolean } = {}) {
  orderNumber += 1
  const [s] = await owner
    .insert(store)
    .values({
      slug: `w-${Math.random().toString(36).slice(2)}`,
      name: 'Waimers',
      shipping: {
        enabled: ['fake'],
        policy: {
          originPincode: '131028',
          warehouse: {
            name: 'Waimers HQ',
            line1: 'Plot 4',
            city: 'Sonipat',
            state: 'HR',
            phone: '9',
          },
        },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.id,
      name: 'Asha',
      line1: '12 MG Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560001',
      phone: '9999999999',
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Large', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: orderNumber,
      status: 'open',
      customerId: cu?.id,
      subtotalPaise: 200000,
      totalPaise: 200000,
      paymentMethod: 'manual',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
      deliveredAt: opts.delivered === undefined ? new Date() : opts.delivered,
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
      variantTitle: 'Large',
      quantity: 2,
      fulfilledQuantity: 2,
      unitPricePaise: 100000,
    })
    .returning()
  if (opts.paid !== false) {
    await owner.insert(payment).values({
      storeId: s.id,
      orderId: o.id,
      provider: 'manual',
      providerRef: `ref_${o.id}`,
      status: 'captured',
      amountPaise: 200000,
    })
  }
  return {
    storeId: s.id,
    orderId: o.id,
    lineId: line?.id as string,
    variantId: v.id,
    customerId: cu?.id as string,
  }
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const onHand = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.onHand

const events = async (storeId: string, type: string) =>
  owner
    .select()
    .from(outboxEvent)
    .where(and(eq(outboxEvent.storeId, storeId), eq(outboxEvent.type, type)))

describe('customer return, start to finish', () => {
  it('request, approve, customer ships, receive with restock, refund: order ends completed', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) =>
      requestReturn(ctx, {
        orderId: s.orderId,
        lines: [{ orderLineId: s.lineId, quantity: 2 }],
        reason: 'damaged',
        note: 'Corner was torn',
        photos: ['https://cdn.example/p.jpg', 'javascript:alert(1)'],
        requestedBy: 'customer',
        customerId: s.customerId,
      }),
    )
    expect(r.number).toBe(1)
    expect(r.photos).toEqual(['https://cdn.example/p.jpg'])
    expect(await events(s.storeId, 'return.requested')).toHaveLength(1)

    await inStore(s.storeId, (ctx) => approveReturn(ctx, r.id))
    await inStore(s.storeId, (ctx) => arrangeReturnPickup(ctx, r.id, null))
    const received = await inStore(s.storeId, (ctx) =>
      receiveReturn(ctx, r.id, { condition: 'good' }),
    )
    expect(received.status).toBe('received')
    expect(received.restockedAt).not.toBeNull()
    expect(await onHand(s.variantId)).toBe(7)
    const [adj] = await owner
      .select()
      .from(inventoryAdjustment)
      .where(eq(inventoryAdjustment.variantId, s.variantId))
    expect(adj).toMatchObject({ delta: 2, reason: 'returned' })

    // A second restock moves nothing.
    const again = await inStore(s.storeId, (ctx) => restockReturn(ctx, r.id))
    expect(again.moved).toBe(0)

    const done = await inStore(s.storeId, (ctx) =>
      refundReturn(ctx, r.id, { amountPaise: 200000, providerFor: async () => null }),
    )
    expect(done).toMatchObject({ status: 'resolved', resolution: 'refund' })
    expect(done.refundIds).toHaveLength(1)
    const [o] = await owner.select().from(order).where(eq(order.id, s.orderId))
    expect(o).toMatchObject({
      paymentStatus: 'refunded',
      fulfillmentStatus: 'returned',
      status: 'completed',
    })
    for (const type of [
      'return.approved',
      'return.received',
      'return.refunded',
      'refund.created',
    ]) {
      expect(await events(s.storeId, type)).toHaveLength(1)
    }
  })

  it('holds shoppers to the window, the reason list, their own order and the delivered quantity', async () => {
    const s = await seed({ delivered: new Date(Date.now() - 30 * DAY) })
    const ask = (over: Partial<Parameters<typeof requestReturn>[1]> = {}) =>
      inStore(s.storeId, (ctx) =>
        requestReturn(ctx, {
          orderId: s.orderId,
          lines: [{ orderLineId: s.lineId, quantity: 1 }],
          reason: 'damaged',
          requestedBy: 'customer',
          customerId: s.customerId,
          ...over,
        }),
      )
    await expect(ask()).rejects.toThrow(/time to return/)
    await owner.update(order).set({ deliveredAt: new Date() }).where(eq(order.id, s.orderId))
    await expect(ask({ reason: 'changed_mind' })).rejects.toThrow(/reason/)
    await expect(ask({ customerId: s.orderId })).rejects.toThrow(/not found/)
    await expect(ask({ lines: [{ orderLineId: s.lineId, quantity: 3 }] })).rejects.toThrow(
      /more than was delivered/,
    )
    await ask({ lines: [{ orderLineId: s.lineId, quantity: 2 }] })
    await expect(ask()).rejects.toThrow(/already being returned/)
    // The merchant is not held to the window, but cannot exceed what shipped either.
    await owner
      .update(order)
      .set({ deliveredAt: new Date(Date.now() - 60 * DAY) })
      .where(eq(order.id, s.orderId))
    await expect(
      inStore(s.storeId, (ctx) =>
        requestReturn(ctx, {
          orderId: s.orderId,
          lines: [{ orderLineId: s.lineId, quantity: 1 }],
          reason: 'other',
          requestedBy: 'merchant',
        }),
      ),
    ).rejects.toThrow(/more than was delivered/)
  })

  it('reject needs a reason, frees the items, and is announced', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) =>
      requestReturn(ctx, {
        orderId: s.orderId,
        lines: [{ orderLineId: s.lineId, quantity: 1 }],
        reason: 'quality',
        requestedBy: 'customer',
        customerId: s.customerId,
      }),
    )
    await expect(inStore(s.storeId, (ctx) => rejectReturn(ctx, r.id, '  '))).rejects.toThrow()
    const out = await inStore(s.storeId, (ctx) => rejectReturn(ctx, r.id, 'Used item'))
    expect(out).toMatchObject({ status: 'rejected', decisionNote: 'Used item' })
    expect(await events(s.storeId, 'return.rejected')).toHaveLength(1)
    const state = await inStore(s.storeId, (ctx) => orderReturnState(ctx, s.orderId))
    expect(state?.eligibility.lines[0]?.returnable).toBe(2)
  })

  it('books a reverse pickup with a courier that supports it', async () => {
    const s = await seed()
    const r = await inStore(s.storeId, (ctx) =>
      requestReturn(ctx, {
        orderId: s.orderId,
        lines: [{ orderLineId: s.lineId, quantity: 1 }],
        reason: 'wrong_item',
        requestedBy: 'merchant',
      }),
    )
    await inStore(s.storeId, (ctx) => approveReturn(ctx, r.id))
    const booked = await inStore(s.storeId, (ctx) =>
      arrangeReturnPickup(ctx, r.id, new FakeShippingProvider()),
    )
    expect(booked).toMatchObject({ status: 'in_transit', pickupMethod: 'courier' })
    expect(booked.pickupWaybill).toMatch(/^DEMORET/)
  })

  it('settles with store credit or an exchange draft', async () => {
    const s = await seed()
    const make = async () => {
      const r = await inStore(s.storeId, (ctx) =>
        requestReturn(ctx, {
          orderId: s.orderId,
          lines: [{ orderLineId: s.lineId, quantity: 1 }],
          reason: 'damaged',
          requestedBy: 'merchant',
        }),
      )
      await inStore(s.storeId, (ctx) => approveReturn(ctx, r.id))
      await inStore(s.storeId, (ctx) => receiveReturn(ctx, r.id, { condition: 'damaged' }))
      return r
    }
    const a = await make()
    expect(await onHand(s.variantId)).toBe(5) // damaged: not restocked
    const credit = await inStore(s.storeId, (ctx) =>
      storeCreditReturn(ctx, a.id, { amountPaise: 100000, secret: SECRET }),
    )
    const [card] = await owner.select().from(giftCard).where(eq(giftCard.id, credit.giftCardId))
    expect(card).toMatchObject({ balancePaise: 100000, customerId: s.customerId })
    expect(credit.row.resolution).toBe('store_credit')

    const b = await make()
    const ex = await inStore(s.storeId, (ctx) => exchangeReturn(ctx, b.id))
    const [draft] = await owner.select().from(order).where(eq(order.id, ex.draftId))
    expect(draft).toMatchObject({ status: 'draft', totalPaise: 0 })
    const listed = await inStore(s.storeId, (ctx) => listReturns(ctx, { search: 'R-2' }))
    expect(listed.items.map((i) => i.label)).toEqual(['R-2'])
  })

  it('keeps one store from reading another store’s returns', async () => {
    const a = await seed()
    const b = await seed()
    const r = await inStore(a.storeId, (ctx) =>
      requestReturn(ctx, {
        orderId: a.orderId,
        lines: [{ orderLineId: a.lineId, quantity: 1 }],
        reason: 'damaged',
        requestedBy: 'merchant',
      }),
    )
    expect(await inStore(b.storeId, (ctx) => getReturn(ctx, r.id))).toBeNull()
    expect((await inStore(b.storeId, (ctx) => listReturns(ctx))).total).toBe(0)
  })

  it('saves the policy', async () => {
    const s = await seed()
    const saved = await inStore(s.storeId, (ctx) =>
      saveReturnPolicy(ctx, { ...defaultReturnPolicy, windowDays: 10, reasons: ['damaged'] }),
    )
    expect(saved.windowDays).toBe(10)
    const [row] = await owner.select().from(store).where(eq(store.id, s.storeId))
    expect(row?.returns).toMatchObject({ windowDays: 10, reasons: ['damaged'] })
  })
})

describe('RTO', () => {
  const rtoScan = (waybill: string): Tracking => ({
    waybill,
    status: 'rto',
    events: [{ at: new Date().toISOString(), status: 'rto', description: 'RTO delivered' }],
  })

  it('opens one task per returned shipment, restocks in one click and re-ships', async () => {
    const s = await seed({ delivered: null })
    await owner
      .update(orderLine)
      .set({ fulfilledQuantity: 0 })
      .where(eq(orderLine.orderId, s.orderId))
    await owner
      .update(inventoryLevel)
      .set({ reserved: 2 })
      .where(eq(inventoryLevel.variantId, s.variantId))
    const sh = await inStore(s.storeId, (ctx) =>
      createShipmentForOrder(ctx, new FakeShippingProvider(), s.orderId),
    )
    expect(await onHand(s.variantId)).toBe(3)

    await inStore(s.storeId, (ctx) => applyTracking(ctx, sh.id, rtoScan(sh.waybill)))
    await inStore(s.storeId, (ctx) => applyTracking(ctx, sh.id, rtoScan(sh.waybill)))
    const tasks = await owner
      .select()
      .from(returnRequest)
      .where(eq(returnRequest.orderId, s.orderId))
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ kind: 'rto', status: 'received', restock: false })
    expect(await events(s.storeId, 'order.rto')).toHaveLength(1)
    const [back] = await owner.select().from(shipment).where(eq(shipment.id, sh.id))
    expect(back?.rtoDeliveredAt).not.toBeNull()
    const [o] = await owner.select().from(order).where(eq(order.id, s.orderId))
    expect(o?.fulfillmentStatus).toBe('returned')

    const task = tasks[0] as (typeof tasks)[number]
    await inStore(s.storeId, (ctx) => restockReturn(ctx, task.id))
    expect(await onHand(s.variantId)).toBe(5)

    const summary = await inStore(s.storeId, (ctx) => rtoSummary(ctx))
    expect(summary).toMatchObject({ count: 1, shipments: 1, open: 1, goodsPaise: 200000 })

    const shipped = await inStore(s.storeId, (ctx) =>
      reshipReturn(ctx, task.id, new FakeShippingProvider(() => Date.now() + 60_000)),
    )
    expect(shipped).toMatchObject({ status: 'resolved', resolution: 'reship' })
    expect(await onHand(s.variantId)).toBe(3)
    const all = await owner.select().from(shipment).where(eq(shipment.orderId, s.orderId))
    expect(all).toHaveLength(2)
    const [after] = await owner.select().from(order).where(eq(order.id, s.orderId))
    expect(after?.fulfillmentStatus).toBe('fulfilled')
  })

  it('refunds a prepaid RTO in full by default', async () => {
    const s = await seed({ delivered: null })
    const sh = await inStore(s.storeId, (ctx) =>
      createShipmentForOrder(ctx, new FakeShippingProvider(), s.orderId),
    )
    await inStore(s.storeId, (ctx) => applyTracking(ctx, sh.id, rtoScan(sh.waybill)))
    const [task] = await owner
      .select()
      .from(returnRequest)
      .where(eq(returnRequest.orderId, s.orderId))
    await inStore(s.storeId, (ctx) =>
      refundReturn(ctx, task?.id as string, { amountPaise: 200000, providerFor: async () => null }),
    )
    const refunds = await owner.select().from(refund).where(eq(refund.orderId, s.orderId))
    expect(refunds.map((r) => r.amountPaise)).toEqual([200000])
    // RTOs do not email the shopper a "return refunded" message.
    expect(await events(s.storeId, 'return.refunded')).toHaveLength(0)
    const [o] = await owner.select().from(order).where(eq(order.id, s.orderId))
    expect(o).toMatchObject({ paymentStatus: 'refunded', status: 'completed' })
  })
})
