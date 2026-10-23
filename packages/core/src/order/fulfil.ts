import { fulfillmentOrderLine, order, orderLine, shipment } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { BalanceDue, CommerceError } from '../errors'
import {
  ensureFulfillmentOrders,
  type PackPick,
  packFulfillmentOrderLines,
} from './fulfillment-orders'
import { packingSnapshot } from './profit-parcels'
import { recomputeOrderStatuses } from './recompute'

export type FulfilLineInput = { lineId: string; quantity: number }

export type FulfilOrderInput = {
  orderId: string
  lines: FulfilLineInput[]
  /** Courier name typed by the merchant when the parcel is not booked through a plugin. */
  courier?: string | undefined
  trackingNumber?: string | undefined
  trackingUrl?: string | undefined
}

export type FulfilOrderResult = {
  orderId: string
  /** True once every line is packed, which is when the fulfilment status becomes "fulfilled". */
  complete: boolean
  fulfilledLines: number
  shipmentId: string | null
}

export class NothingToFulfil extends CommerceError {
  constructor(orderId: string, storeId?: string) {
    super('NOTHING_TO_FULFIL', `Order ${orderId} has nothing left to pack`, { storeId })
  }
}

export class FulfilTooMany extends CommerceError {
  constructor(lineId: string, storeId?: string) {
    super('FULFIL_TOO_MANY', `You cannot pack more of line ${lineId} than was ordered`, { storeId })
  }
}

export class OrderNotFulfillable extends CommerceError {
  constructor(orderId: string, status: string, storeId?: string) {
    super('ORDER_NOT_FULFILLABLE', `Order ${orderId} is ${status} and cannot be packed`, {
      storeId,
    })
  }
}

const MANUAL_PROVIDER = 'manual'

/** Drafts hold no stock and cancelled orders gave theirs back: neither can ship. */
const UNFULFILLABLE = new Set(['draft', 'cancelled'])

/**
 * Lock the order and its lines for the rest of the transaction, so a second
 * pack or a cancel running at the same time waits and then sees this one's
 * result instead of moving the same stock twice. An order older than parcels
 * gets them first, from what was packed before this call moves anything.
 */
async function lockOrder(ctx: StoreContext, orderId: string) {
  await ensureFulfillmentOrders(ctx, orderId)
  const [o] = await ctx.tx
    .select({
      id: order.id,
      status: order.status,
      balanceDuePaise: order.balanceDuePaise,
      balancePaidAt: order.balancePaidAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  const lines = await ctx.tx
    .select()
    .from(orderLine)
    .where(eq(orderLine.orderId, orderId))
    .for('update')
  return { o, lines }
}

/** A deposit-mode pre-order with money still owed blocks fulfilment until the balance is paid. */
function assertNoBalanceDue(
  ctx: StoreContext,
  orderId: string,
  o: { balanceDuePaise: number | null; balancePaidAt: Date | null } | undefined,
): void {
  if (o && (o.balanceDuePaise ?? 0) > 0 && !o.balancePaidAt) {
    throw new BalanceDue(orderId, o.balanceDuePaise ?? 0, ctx.storeId)
  }
}

/**
 * Mark every unpacked unit of an order as packed and take it out of stock.
 * Used when the whole order ships at once (a courier booking, or the merchant
 * setting the status to fulfilled). Running it again moves nothing.
 */
export async function fulfilRemainingLines(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** False: no "order shipped" message to the shopper (an automation's choice). */
    notifyCustomer?: boolean | undefined
  } = {},
): Promise<void> {
  const { o, lines } = await lockOrder(ctx, orderId)
  if (!o || UNFULFILLABLE.has(o.status)) return
  assertNoBalanceDue(ctx, orderId, o)
  const picks: PackPick[] = []
  for (const line of lines) {
    const remaining = line.quantity - line.fulfilledQuantity
    if (remaining <= 0) continue
    await ctx.tx
      .update(orderLine)
      .set({ fulfilledQuantity: line.quantity })
      .where(eq(orderLine.id, line.id))
    // Gift cards are vouchers: nothing leaves a shelf.
    if (!line.giftCard) {
      picks.push({ orderLineId: line.id, variantId: line.variantId, quantity: remaining })
    }
  }
  await packFulfillmentOrderLines(ctx, orderId, picks)
  await recomputeOrderStatuses(ctx, orderId, opts)
}

/**
 * Mark every unpacked unit of one parcel as packed and take it out of stock at that parcel's
 * location: a courier booking for that parcel alone, when the order ships in several. The
 * order's other parcels are left as they are. Running it again moves nothing.
 */
export async function fulfilParcelLines(
  ctx: StoreContext,
  orderId: string,
  fulfillmentOrderId: string,
): Promise<void> {
  const { o, lines } = await lockOrder(ctx, orderId)
  if (!o || UNFULFILLABLE.has(o.status)) return
  assertNoBalanceDue(ctx, orderId, o)
  const units = await ctx.tx
    .select({
      orderLineId: fulfillmentOrderLine.orderLineId,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
    })
    .from(fulfillmentOrderLine)
    .where(eq(fulfillmentOrderLine.fulfillmentOrderId, fulfillmentOrderId))
  const byId = new Map(lines.map((l) => [l.id, l]))
  const picks: PackPick[] = []
  for (const unit of units) {
    const line = byId.get(unit.orderLineId)
    if (!line) continue
    const take = Math.min(
      unit.quantity - unit.fulfilledQuantity,
      line.quantity - line.fulfilledQuantity,
    )
    if (take <= 0) continue
    await ctx.tx
      .update(orderLine)
      .set({ fulfilledQuantity: sql`${orderLine.fulfilledQuantity} + ${take}` })
      .where(eq(orderLine.id, line.id))
    if (!line.giftCard) {
      picks.push({ orderLineId: line.id, variantId: line.variantId, quantity: take })
    }
  }
  await packFulfillmentOrderLines(ctx, orderId, picks, fulfillmentOrderId)
  await recomputeOrderStatuses(ctx, orderId)
}

/**
 * Pack some or all of an order by hand: the merchant picks lines and
 * quantities, optionally with a courier and tracking number. Booking through a
 * shipping plugin is a separate path (`bookShipment`); this one records what
 * the merchant did themselves, so the only side effects are in the database.
 *
 * Must run inside `withStore`. Marking the order fulfilled is left to the
 * caller's notification step so the shopper is told once, not per line.
 */
export async function fulfilOrderLines(
  ctx: StoreContext,
  input: FulfilOrderInput,
): Promise<FulfilOrderResult> {
  const { o, lines } = await lockOrder(ctx, input.orderId)
  if (o && UNFULFILLABLE.has(o.status)) {
    throw new OrderNotFulfillable(input.orderId, o.status, ctx.storeId)
  }
  assertNoBalanceDue(ctx, input.orderId, o)
  const byId = new Map(lines.map((l) => [l.id, l]))

  const wanted = input.lines.filter((l) => l.quantity > 0)
  if (wanted.length === 0) throw new NothingToFulfil(input.orderId, ctx.storeId)

  /* Summed per line, so the same line listed twice cannot pack past its quantity. */
  const packing = new Map<string, number>()
  for (const pick of wanted) {
    const line = byId.get(pick.lineId)
    if (!line) throw new FulfilTooMany(pick.lineId, ctx.storeId)
    const total = (packing.get(pick.lineId) ?? 0) + pick.quantity
    if (line.fulfilledQuantity + total > line.quantity) {
      throw new FulfilTooMany(pick.lineId, ctx.storeId)
    }
    packing.set(pick.lineId, total)
  }

  const picks: PackPick[] = []
  for (const pick of wanted) {
    await ctx.tx
      .update(orderLine)
      .set({ fulfilledQuantity: sql`${orderLine.fulfilledQuantity} + ${pick.quantity}` })
      .where(and(eq(orderLine.id, pick.lineId), eq(orderLine.orderId, input.orderId)))
    const line = byId.get(pick.lineId)
    if (line && !line.giftCard) {
      picks.push({ orderLineId: line.id, variantId: line.variantId, quantity: pick.quantity })
    }
  }
  const packed = await packFulfillmentOrderLines(ctx, input.orderId, picks)
  // A parcel booked by hand carries the one parcel its units came out of, when there is one.
  const parcels = [...new Set(packed.map((p) => p.fulfillmentOrderId))]
  const fulfillmentOrderId = parcels.length === 1 ? (parcels[0] ?? null) : null

  const after = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, input.orderId))
  const complete = after.every((l) => l.fulfilledQuantity >= l.quantity)

  let shipmentId: string | null = null
  const waybill = input.trackingNumber?.trim()
  if (waybill) {
    /* One shipment row per waybill: re-packing under the same number updates it
       rather than creating a duplicate the tracking poller would fight over. */
    const packing = await packingSnapshot(ctx.tx, picks)
    const [row] = await ctx.tx
      .insert(shipment)
      .values({
        storeId: ctx.storeId,
        orderId: input.orderId,
        fulfillmentOrderId,
        provider: input.courier?.trim() || MANUAL_PROVIDER,
        waybill,
        status: 'created',
        trackingUrl: input.trackingUrl?.trim() || null,
        ...packing,
      })
      .onConflictDoUpdate({
        target: [shipment.provider, shipment.waybill],
        set: { orderId: input.orderId, fulfillmentOrderId, updatedAt: new Date() },
      })
      .returning({ id: shipment.id })
    shipmentId = row?.id ?? null
  }

  /* Packing moves only the fulfilment status; an unpaid (cash on delivery)
     order stays unpaid until the money is collected. */
  await recomputeOrderStatuses(ctx, input.orderId)

  return {
    orderId: input.orderId,
    complete,
    fulfilledLines: wanted.length,
    shipmentId,
  }
}
