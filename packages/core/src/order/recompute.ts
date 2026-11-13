import {
  order,
  orderLine,
  orderNote,
  payment,
  refund,
  returnRequest,
  returnRequestLine,
  shipment,
} from '@commerce/db'
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { COD_RTO_TAGS } from '../cod-rto/settings'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { isSplitTender } from '../payments/split-tender'
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
  paysOnlineAtCheckout,
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
      provider: payment.provider,
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

/** Money collected outside a gateway: a capture on these never makes a COD order prepaid. */
const OFFLINE_PROVIDERS: ReadonlySet<string> = new Set(['cod', 'manual'])

const COD_PAID_ONLINE_NOTE =
  'Paid online, so this order now ships prepaid instead of cash on delivery.'

/**
 * A cash on delivery order the shopper paid online after all ("Ask to pay online",
 * `payments/pay-online-instead.ts`): once a gateway capture covers it, it is a prepaid order, so
 * booking, the bulk ship drawer and order push stop asking the courier to collect cash. A COD
 * confirmation still waiting is answered by the payment. Cash collected at the door (a `cod` or
 * `manual` capture) changes nothing.
 */
async function codPaidOnline(
  ctx: StoreContext,
  o: OrderRow,
  payments: readonly { provider: string; status: string; refundNeeded: boolean }[],
): Promise<void> {
  const online = payments.find(
    (p) =>
      p.status === 'captured' &&
      !p.refundNeeded &&
      !OFFLINE_PROVIDERS.has(p.provider) &&
      !isSplitTender(p.provider),
  )
  if (!online) return
  const waiting = o.codVerification === 'pending' || o.codVerification === 'unconfirmed'
  await ctx.tx
    .update(order)
    .set({
      paymentMethod: online.provider,
      ...(waiting
        ? {
            codVerification: 'confirmed' as const,
            codVerifiedAt: new Date(),
            tags: o.tags.filter((t) => t !== COD_RTO_TAGS.unconfirmed),
          }
        : {}),
    })
    .where(eq(order.id, o.id))
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: o.id,
    body: COD_PAID_ONLINE_NOTE,
    author: 'system',
  })
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
        requiresShipping: orderLine.requiresShipping,
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
  // Packed is done for an order with nothing to ship: gift cards, services, downloads.
  const hasPhysicalLines = lines.some((l) => !l.giftCard && l.requiresShipping)
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
  // The first money on a gateway checkout, captured or authorised, is when it becomes an order.
  const held = paysOnlineAtCheckout(o) && before.paymentStatus !== 'authorized'
  let becamePaid = false
  if (live && !o.checkoutPaidAt && isCheckoutSettled(o, payments)) {
    const [marked] = await ctx.tx
      .update(order)
      .set({ checkoutPaidAt: new Date() })
      .where(and(eq(order.id, orderId), isNull(order.checkoutPaidAt)))
      .returning({ id: order.id })
    if (marked) {
      becamePaid = true
      if (o.paymentMethod === 'cod') await codPaidOnline(ctx, o, payments)
      // `order.placed` below tells the shopper; one confirmation is enough.
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.paid', {
        orderId,
        ...(held ? { notifyCustomer: false } : {}),
      })
    }
  }
  if (held && live && (becamePaid || paymentStatus === 'authorized')) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId })
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
