import {
  order,
  orderLine,
  payment,
  refund,
  returnRequest,
  returnRequestLine,
  shipment,
} from '@commerce/db'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import {
  asLifecycle,
  deriveFulfillmentStatus,
  deriveLifecycle,
  derivePaymentStatus,
  importedOrderStatuses,
  isCheckoutSettled,
  type OrderFulfillmentStatus,
  type OrderLifecycleStatus,
  type OrderPaymentStatus,
  UNFULFILLED_STATUSES,
} from './aggregate-status'

type OrderRow = typeof order.$inferSelect

/* The stored enums and the pure lists must stay the same set. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const _lifecycle: Same<OrderRow['status'], OrderLifecycleStatus> = true
const _payment: Same<OrderRow['paymentStatus'], OrderPaymentStatus> = true
const _fulfillment: Same<OrderRow['fulfillmentStatus'], OrderFulfillmentStatus> = true
void _lifecycle
void _payment
void _fulfillment

export type OrderStatuses = {
  status: OrderLifecycleStatus
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
}

export type RecomputeResult = {
  before: OrderStatuses
  after: OrderStatuses
  changed: boolean
  /** This call is the one that saw the checkout amount arrive (and wrote `order.paid`). */
  becamePaid: boolean
  /** This call saw the last unit packed (and wrote `order.fulfilled`). */
  becameFulfilled: boolean
}

const pick = (o: OrderRow): OrderStatuses => ({
  status: o.status,
  paymentStatus: o.paymentStatus,
  fulfillmentStatus: o.fulfillmentStatus,
})

/** Payment rows with what has gone back on each, for the derivation. */
async function paymentFacts(ctx: StoreContext, orderId: string) {
  const rows = await ctx.tx
    .select({
      id: payment.id,
      status: payment.status,
      amountPaise: payment.amountPaise,
      refundNeeded: payment.refundNeeded,
    })
    .from(payment)
    .where(eq(payment.orderId, orderId))
  const ids = rows.map((r) => r.id)
  const back = ids.length
    ? await ctx.tx
        .select({
          paymentId: refund.paymentId,
          total: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int`,
        })
        .from(refund)
        .where(and(inArray(refund.paymentId, ids), ne(refund.status, 'failed')))
        .groupBy(refund.paymentId)
    : []
  const byPayment = new Map(back.map((r) => [r.paymentId, Number(r.total)]))
  return rows.map((r) => ({ ...r, refundedPaise: byPayment.get(r.id) ?? 0 }))
}

/**
 * Derive and store an order's lifecycle, payment and fulfilment statuses from
 * its payments, refunds, lines and shipments. Every path that changes any of
 * those calls this in the same transaction, after its own writes; calling it
 * twice is harmless. Locks the order row.
 *
 * Events are written here, and only on a real transition: `order.paid` by the
 * call that sets `checkout_paid_at`, `order.fulfilled` by the call that sees
 * the last physical unit packed. Drafts, cancelled and imported orders never
 * announce anything. Cancellation stays with the cancel paths, which already
 * write `order.cancelled` on their own flip.
 */
export async function recomputeOrderStatuses(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** False: the `order.fulfilled` this call may write tells the shopper nothing. */
    notifyCustomer?: boolean | undefined
  } = {},
): Promise<RecomputeResult | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) return null
  const before = pick(o)

  if (o.importedFrom) {
    const after = importedOrderStatuses(o.importMeta ?? {})
    const next = o.status === 'draft' ? { ...after, status: o.status } : after
    const changed =
      next.status !== before.status ||
      next.paymentStatus !== before.paymentStatus ||
      next.fulfillmentStatus !== before.fulfillmentStatus
    if (changed) await ctx.tx.update(order).set(next).where(eq(order.id, orderId))
    return { before, after: next, changed, becamePaid: false, becameFulfilled: false }
  }

  const [payments, lines, shipments, returned] = await Promise.all([
    paymentFacts(ctx, orderId),
    ctx.tx
      .select({
        quantity: orderLine.quantity,
        fulfilledQuantity: orderLine.fulfilledQuantity,
        giftCard: orderLine.giftCard,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, orderId)),
    ctx.tx.select({ status: shipment.status }).from(shipment).where(eq(shipment.orderId, orderId)),
    // Units customers sent back that reached the merchant (RTOs count through the shipment).
    ctx.tx
      .select({ units: sql<number>`coalesce(sum(${returnRequestLine.quantity}), 0)::int` })
      .from(returnRequestLine)
      .innerJoin(returnRequest, eq(returnRequest.id, returnRequestLine.returnRequestId))
      .where(
        and(
          eq(returnRequest.orderId, orderId),
          eq(returnRequest.kind, 'return'),
          inArray(returnRequest.status, ['received', 'resolved']),
        ),
      ),
  ])

  const paymentStatus = derivePaymentStatus({ totalPaise: o.totalPaise, payments })
  const fulfillmentStatus = deriveFulfillmentStatus({
    lines,
    shipments,
    deliveredAt: o.deliveredAt,
    returnedUnits: Number(returned[0]?.units ?? 0),
  })
  const hasPhysicalLines = lines.some((l) => !l.giftCard)
  const status = deriveLifecycle({
    current: asLifecycle(o.status),
    payment: paymentStatus,
    fulfillment: fulfillmentStatus,
    hasPhysicalLines,
  })
  const after: OrderStatuses = { status, paymentStatus, fulfillmentStatus }
  const changed =
    after.status !== before.status ||
    after.paymentStatus !== before.paymentStatus ||
    after.fulfillmentStatus !== before.fulfillmentStatus
  if (changed) await ctx.tx.update(order).set(after).where(eq(order.id, orderId))

  const live = status === 'open' || status === 'completed'
  let becamePaid = false
  if (live && !o.checkoutPaidAt && isCheckoutSettled(o, payments)) {
    const [marked] = await ctx.tx
      .update(order)
      .set({ checkoutPaidAt: new Date() })
      .where(and(eq(order.id, orderId), isNull(order.checkoutPaidAt)))
      .returning({ id: order.id })
    if (marked) {
      becamePaid = true
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.paid', { orderId })
    }
  }

  const fullyPacked = lines.length > 0 && lines.every((l) => l.fulfilledQuantity >= l.quantity)
  const becameFulfilled =
    live &&
    hasPhysicalLines &&
    fullyPacked &&
    UNFULFILLED_STATUSES.includes(before.fulfillmentStatus)
  if (becameFulfilled) {
    // The outbox row is pruned after 90 days; the order keeps when, for its timeline (#121).
    await ctx.tx.update(order).set({ fulfilledAt: new Date() }).where(eq(order.id, orderId))
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.fulfilled', {
      orderId,
      ...(opts.notifyCustomer === false ? { notifyCustomer: false } : {}),
    })
  }

  return { before, after, changed, becamePaid, becameFulfilled }
}
