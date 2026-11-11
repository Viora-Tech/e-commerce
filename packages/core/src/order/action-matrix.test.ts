/** SOURCE OF TRUTH: order action matrix test — WHAT: every order action chained the way staff press them, with the books checked after each step / WHY: order handling broke in ways each single-action test missed (owner, 11 Nov 2026) */
/**
 * The order action matrix (docs/audits/2026-11-11-order-action-matrix.md), run against a real
 * database: every action the order page, the orders list and the bulk bar offer, chained the way
 * staff press them, with the books checked after each step. The invariants:
 *
 * - each order line's `fulfilled_quantity` equals what its parcels say they packed;
 * - stock held (`reserved`) equals the unpacked units of live orders' open parcels;
 * - stock on hand dropped by exactly the units packed;
 * - the stored statuses are what the facts derive (a recompute changes nothing);
 * - an order with nothing packed has no live shipment.
 */
import {
  address,
  cart,
  cartLine,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  inventoryLevel,
  order,
  orderLine,
  outboxEvent,
  product,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider } from '@commerce/shipping'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { CodPaymentProvider } from '../providers/cod'
import { cancelShipment } from '../shipping/shipment-cancel'
import { applyTracking, createShipmentForOrder } from '../shipping/shipments'
import { editOrder } from './edit'
import { OrderEditSchema } from './edit-plan'
import { fulfilAllLines, fulfilOrderLines } from './fulfil'
import { holdFulfillment, releaseFulfillment } from './fulfillment-hold'
import { placeOrderAndPay } from './place-order'
import { recomputeOrderStatuses } from './recompute'
import { restoreCancelledOrder } from './restore-order'
import { cancelOrderByStaff } from './staff-cancel'
import { cancelOrder, changeOrderStatus } from './status'
import { undoDelivered } from './undo-delivered'
import { undoPacked } from './undo-packed'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const ON_HAND = 5

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A cash-on-delivery order for 2 of one tracked product (5 on hand), with an address. */
async function placeCod() {
  const [s] = await owner.insert(store).values({ slug: 'm', name: 'm' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: ON_HAND })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: 2,
    unitPricePaise: 10000,
  })
  const r = await placeOrderAndPay(app, s.id, {
    cartId: c.id,
    paymentProvider: new CodPaymentProvider(),
  })
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.id,
      name: 'Test',
      line1: '1 Test Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560001',
      phone: '9999999999',
    })
    .returning()
  await owner.update(order).set({ shippingAddressId: a?.id }).where(eq(order.id, r.orderId))
  const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, r.orderId))
  if (!line) throw new Error('seed')
  return { storeId: s.id, orderId: r.orderId, lineId: line.id }
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

const statuses = async (orderId: string) => {
  const [o] = await owner.select().from(order).where(eq(order.id, orderId))
  return [o?.status, o?.paymentStatus, o?.fulfillmentStatus]
}

/** Every invariant in the header, for one order in a one-order store. */
async function assertBooks(storeId: string, orderId: string) {
  const [o] = await owner.select().from(order).where(eq(order.id, orderId))
  const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, orderId))
  const parcelLines = await owner
    .select({
      orderLineId: fulfillmentOrderLine.orderLineId,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
      parcelStatus: fulfillmentOrder.status,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(fulfillmentOrder, eq(fulfillmentOrder.id, fulfillmentOrderLine.fulfillmentOrderId))
    .where(eq(fulfillmentOrder.orderId, orderId))
  // 1. Lines and parcels agree on what was packed.
  for (const l of lines) {
    const inParcels = parcelLines
      .filter((p) => p.orderLineId === l.id)
      .reduce((n, p) => n + p.fulfilledQuantity, 0)
    expect({ line: l.fulfilledQuantity, parcels: inParcels }).toEqual({
      line: inParcels,
      parcels: inParcels,
    })
  }
  // 2. Held stock is the live order's unpacked units in parcels still open.
  const live = o?.status !== 'cancelled' && o?.status !== 'draft'
  const owed = live
    ? parcelLines
        .filter((p) => p.parcelStatus !== 'cancelled')
        .reduce((n, p) => n + (p.quantity - p.fulfilledQuantity), 0)
    : 0
  const [level] = await owner
    .select()
    .from(inventoryLevel)
    .where(eq(inventoryLevel.storeId, storeId))
  expect({ reserved: level?.reserved }).toEqual({ reserved: owed })
  // 3. On hand dropped by exactly what was packed.
  const packed = lines.reduce((n, l) => n + l.fulfilledQuantity, 0)
  expect({ onHand: level?.onHand }).toEqual({ onHand: ON_HAND - packed })
  // 4. Stored statuses are what the facts derive.
  const r = await inStore(storeId, (ctx) => recomputeOrderStatuses(ctx, orderId))
  expect({ drifted: r?.changed }).toEqual({ drifted: false })
  // 5. Nothing packed: no live shipment.
  if (packed === 0) {
    const liveShipments = await owner
      .select({ id: shipment.id })
      .from(shipment)
      .where(and(eq(shipment.orderId, orderId), notInArray(shipment.status, ['cancelled', 'rto'])))
    expect({ liveShipments: liveShipments.length }).toEqual({ liveShipments: 0 })
  }
}

const withLabel = (shipmentId: string) =>
  owner
    .update(shipment)
    .set({ labelUrl: 'https://labels.test/1.pdf' })
    .where(eq(shipment.id, shipmentId))

describe('order action matrix: fulfil and unfulfil', () => {
  it('pack form with courier + tracking, then Mark as unfulfilled', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await assertBooks(storeId, orderId)
    const r = await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, {
        orderId,
        lines: [{ lineId, quantity: 2 }],
        courier: 'Delhivery',
        trackingNumber: 'AWB1',
      }),
    )
    expect(r.shipmentId).not.toBeNull()
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'fulfilled'])
    await assertBooks(storeId, orderId)
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: true,
      units: 2,
    })
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    await assertBooks(storeId, orderId)
  })

  it('part-packed by hand, the rest by Mark as fulfilled, then unfulfilled', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
    )
    expect((await statuses(orderId))[2]).toBe('partially_fulfilled')
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => undoPacked(ctx, orderId))
    await assertBooks(storeId, orderId)
    // And packed again after the undo.
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await assertBooks(storeId, orderId)
  })

  it('a held order refuses Mark as fulfilled and the pack form until released', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) => holdFulfillment(ctx, orderId, null))
    await expect(
      inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled')),
    ).rejects.toThrow()
    await expect(
      inStore(storeId, (ctx) =>
        fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
      ),
    ).rejects.toThrow()
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => releaseFulfillment(ctx, orderId))
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await assertBooks(storeId, orderId)
  })
})

describe('order action matrix: courier shipments', () => {
  it('book, cancel shipment, book again, cancel again', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const first = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await withLabel(first.id)
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    await assertBooks(storeId, orderId)
    // A live label refuses Mark as unfulfilled.
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: false,
      reason: 'live_shipment',
    })
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, first.id))
    expect((await statuses(orderId))[2]).toBe('unfulfilled')
    await assertBooks(storeId, orderId)
    const again = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    expect(again.id).not.toBe(first.id)
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, again.id))
    await assertBooks(storeId, orderId)
  })

  it('part-packed by hand, then the courier books the rest, then the label is cancelled', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
    )
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, ship.id))
    await assertBooks(storeId, orderId)
  })

  it('Mark as delivered over a live label, then Mark as not delivered', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'delivered'))
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'delivered'])
    await assertBooks(storeId, orderId)
    // Delivered refuses Mark as unfulfilled until the delivery is undone.
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: false,
      reason: 'delivered',
    })
    expect(await inStore(storeId, (ctx) => undoDelivered(ctx, orderId))).toBe(true)
    const [row] = await owner.select().from(shipment).where(eq(shipment.id, ship.id))
    expect(row?.status).toBe('created')
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    await assertBooks(storeId, orderId)
  })

  it('in transit, delivered by tracking, then paid: completed and nothing left to undo by hand', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await inStore(storeId, (ctx) =>
      applyTracking(ctx, ship.id, { waybill: ship.waybill, status: 'in_transit', events: [] }),
    )
    expect((await statuses(orderId))[2]).toBe('shipped')
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) =>
      applyTracking(ctx, ship.id, { waybill: ship.waybill, status: 'delivered', events: [] }),
    )
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'paid'))
    expect(await statuses(orderId)).toEqual(['completed', 'paid', 'delivered'])
    await assertBooks(storeId, orderId)
  })
})

describe('order action matrix: cancel and restore', () => {
  it('cancel (restock) then restore then ship', async () => {
    const { storeId, orderId } = await placeCod()
    await inStore(storeId, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    expect((await statuses(orderId))[0]).toBe('cancelled')
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    await assertBooks(storeId, orderId)
    const provider = new FakeShippingProvider()
    await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await assertBooks(storeId, orderId)
  })

  it('part-packed, cancelled, restored, packed in full', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
    )
    await inStore(storeId, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => undoPacked(ctx, orderId))
    await assertBooks(storeId, orderId)
  })

  it('part-packed with a typed tracking number, cancelled: no live shipment is left behind', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, {
        orderId,
        lines: [{ lineId, quantity: 1 }],
        courier: 'Delhivery',
        trackingNumber: 'AWB-PART',
      }),
    )
    await inStore(storeId, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => undoPacked(ctx, orderId))
    await assertBooks(storeId, orderId)
    const live = await owner
      .select({ id: shipment.id })
      .from(shipment)
      .where(
        and(eq(shipment.orderId, orderId), inArray(shipment.status, ['created', 'in_transit'])),
      )
    expect(live).toEqual([])
  })

  it('cancel without restock (written off) then restore', async () => {
    const { storeId, orderId } = await placeCod()
    await inStore(storeId, (ctx) =>
      cancelOrder(ctx, orderId, { notifyCustomer: false, restock: false }),
    )
    const [level] = await owner.select().from(inventoryLevel)
    // Written off: on hand drops by the 2 held units, nothing goes back on sale.
    expect({ onHand: level?.onHand, reserved: level?.reserved }).toEqual({
      onHand: ON_HAND - 2,
      reserved: 0,
    })
    await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))
    const [after] = await owner.select().from(inventoryLevel)
    // Restored: the 2 are held again out of what is on hand.
    expect({ onHand: after?.onHand, reserved: after?.reserved }).toEqual({
      onHand: ON_HAND - 2,
      reserved: 2,
    })
  })

  it('Mark as paid, cancel, restore: the payment is kept and the order reads paid again', async () => {
    const { storeId, orderId } = await placeCod()
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'paid'))
    expect((await statuses(orderId))[1]).toBe('paid')
    await inStore(storeId, (ctx) => cancelOrder(ctx, orderId, { notifyCustomer: false }))
    await inStore(storeId, (ctx) => restoreCancelledOrder(ctx, orderId))
    expect(await statuses(orderId)).toEqual(['open', 'paid', 'unfulfilled'])
    await assertBooks(storeId, orderId)
  })
})

describe('order action matrix: edit after packing', () => {
  const editLine = (storeId: string, orderId: string, lineId: string, quantity: number) =>
    inStore(storeId, (ctx) =>
      editOrder(
        ctx,
        OrderEditSchema.parse({ orderId, lines: [{ lineId, quantity }] }),
        { refund: 'none', requestPayment: false, author: 'staff@test' },
        [],
      ),
    )

  it('part-packed, edited up to 3, packed in full, unfulfilled', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
    )
    await editLine(storeId, orderId, lineId, 3)
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => undoPacked(ctx, orderId))
    await assertBooks(storeId, orderId)
  })

  it('part-packed, edited down to what was packed: fulfilled, books agree', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
    )
    await editLine(storeId, orderId, lineId, 1)
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => undoPacked(ctx, orderId))
    await assertBooks(storeId, orderId)
  })
})

const eventsFor = async (orderId: string, type: string) =>
  (await owner.select().from(outboxEvent).where(eq(outboxEvent.type, type)))
    .map((e) => e.payload as { orderId?: string; notifyCustomer?: boolean })
    .filter((p) => p.orderId === orderId)

describe('order action matrix: owner answers of 11 Nov', () => {
  it('Mark as delivered with Notify customer off tells the shopper nothing', async () => {
    const { storeId, orderId } = await placeCod()
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await inStore(storeId, (ctx) =>
      changeOrderStatus(ctx, orderId, 'delivered', { notifyCustomer: false }),
    )
    expect(await eventsFor(orderId, 'order.delivered')).toEqual([
      { orderId, notifyCustomer: false },
    ])
    await assertBooks(storeId, orderId)
  })

  it('Mark as delivered with Notify customer on (the default) tells the shopper', async () => {
    const { storeId, orderId } = await placeCod()
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'delivered'))
    expect(await eventsFor(orderId, 'order.delivered')).toEqual([{ orderId }])
  })

  it('bulk Mark as delivered skips an order that never went out, and changes nothing on it', async () => {
    const { storeId, orderId } = await placeCod()
    await expect(
      inStore(storeId, (ctx) =>
        changeOrderStatus(ctx, orderId, 'delivered', { onlyShipped: true }),
      ),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_SHIPPED_YET' })
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    await assertBooks(storeId, orderId)
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await inStore(storeId, (ctx) =>
      changeOrderStatus(ctx, orderId, 'delivered', { onlyShipped: true }),
    )
    expect((await statuses(orderId))[2]).toBe('delivered')
    await assertBooks(storeId, orderId)
  })

  it('bulk Mark as fulfilled packs what is left under one courier, with this order’s tracking', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    await inStore(storeId, (ctx) =>
      fulfilOrderLines(ctx, { orderId, lines: [{ lineId, quantity: 1 }] }),
    )
    const r = await inStore(storeId, (ctx) =>
      fulfilAllLines(ctx, { orderId, courier: 'Delhivery', trackingNumber: 'BULK-1' }),
    )
    expect(r.complete).toBe(true)
    const [s] = await owner.select().from(shipment).where(eq(shipment.orderId, orderId))
    expect({ provider: s?.provider, waybill: s?.waybill }).toEqual({
      provider: 'Delhivery',
      waybill: 'BULK-1',
    })
    expect((await statuses(orderId))[2]).toBe('fulfilled')
    await assertBooks(storeId, orderId)
    // Nothing left: refused, nothing moves.
    await expect(
      inStore(storeId, (ctx) => fulfilAllLines(ctx, { orderId, courier: 'Delhivery' })),
    ).rejects.toMatchObject({ code: 'NOTHING_TO_FULFIL' })
    await assertBooks(storeId, orderId)
  })

  it('bulk Mark as fulfilled refuses a held order and a cancelled one', async () => {
    const held = await placeCod()
    await inStore(held.storeId, (ctx) => holdFulfillment(ctx, held.orderId, null))
    await expect(
      inStore(held.storeId, (ctx) => fulfilAllLines(ctx, { orderId: held.orderId, courier: 'X' })),
    ).rejects.toThrow()
    await assertBooks(held.storeId, held.orderId)
    await inStore(held.storeId, (ctx) => releaseFulfillment(ctx, held.orderId))
    await inStore(held.storeId, (ctx) => cancelOrder(ctx, held.orderId, { notifyCustomer: false }))
    await expect(
      inStore(held.storeId, (ctx) => fulfilAllLines(ctx, { orderId: held.orderId, courier: 'X' })),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FULFILLABLE' })
  })

  it('Cancel order with "Also cancel courier label": the label goes first, then the order', async () => {
    const { storeId, orderId } = await placeCod()
    const provider = new FakeShippingProvider()
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, provider, orderId))
    await withLabel(ship.id)
    // A packed order with a live label cannot be cancelled on its own.
    const cancel = () =>
      inStore(storeId, (ctx) =>
        cancelOrderByStaff(
          ctx,
          { orderId, restock: true, notifyCustomer: false, refund: 'none', author: 'staff@test' },
          [],
        ),
      )
    await expect(cancel()).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' })
    // The API's order: cancel the label (unpacks it), then the order.
    await inStore(storeId, (ctx) => cancelShipment(ctx, provider, ship.id))
    await cancel()
    expect((await statuses(orderId))[0]).toBe('cancelled')
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, ship.id))
    expect(s?.status).toBe('cancelled')
    await assertBooks(storeId, orderId)
  })

  it('a courier that refuses the label cancel leaves the order and its label as they were', async () => {
    const { storeId, orderId } = await placeCod()
    const refusing = new FakeShippingProvider()
    refusing.cancel = async () => {
      throw new Error('Courier says no')
    }
    const ship = await inStore(storeId, (ctx) => createShipmentForOrder(ctx, refusing, orderId))
    await withLabel(ship.id)
    await expect(inStore(storeId, (ctx) => cancelShipment(ctx, refusing, ship.id))).rejects.toThrow(
      'Courier says no',
    )
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'fulfilled'])
    const [s] = await owner.select().from(shipment).where(eq(shipment.id, ship.id))
    expect(s?.status).toBe('created')
    await assertBooks(storeId, orderId)
  })
})

describe('order action matrix: a drifted order can be put right', () => {
  it('lines say packed, parcels and stock say not: Mark as unfulfilled repairs it', async () => {
    const { storeId, orderId, lineId } = await placeCod()
    // The state found on a local copy of a live order: the line reads packed, its parcel and
    // the stock never moved, and the only shipment (from before parcels) was cancelled.
    await owner.update(orderLine).set({ fulfilledQuantity: 2 }).where(eq(orderLine.id, lineId))
    await owner.insert(shipment).values({
      storeId,
      orderId,
      provider: 'delhivery',
      waybill: 'TEST-CANCELLED-1',
      status: 'cancelled',
    })
    await inStore(storeId, (ctx) => recomputeOrderStatuses(ctx, orderId))
    // Stuck before the fix: the pack form had nothing left to pack, and Mark as unfulfilled
    // found nothing packed in the parcels ("Nothing on this order is packed").
    expect(await inStore(storeId, (ctx) => undoPacked(ctx, orderId))).toEqual({
      undone: true,
      units: 2,
    })
    expect(await statuses(orderId)).toEqual(['open', 'unpaid', 'unfulfilled'])
    await assertBooks(storeId, orderId)
    // And it packs normally afterwards.
    await inStore(storeId, (ctx) => changeOrderStatus(ctx, orderId, 'fulfilled'))
    await assertBooks(storeId, orderId)
  })
})
