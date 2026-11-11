/**
 * SOURCE OF TRUTH KEYWORDS: settleRefunds, syncRefundedStatus, partly refunded payment
 * WHAT:  Record what a gateway finally did with a refund (processed or failed) and keep the
 *        payment row's status honest: `refunded` only when every paisa captured went back; a
 *        payment refunded in part stays `captured` (shown as "Partly refunded", derived from
 *        the refund rows).
 * WHY:   The refund webhook used to set the payment to `refunded` on any refund, even ₹1 of
 *        ₹1,000, and a refund that later failed left it `refunded`.
 * WHERE: The payment webhook (refund.processed / refund.failed) and the worker's refund sync.
 */
import { order, payment, refund } from '@commerce/db'
import { and, eq, inArray, ne, type SQL } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recomputeOrderStatuses } from '../order/recompute'
import { refundedPaise } from '../order/refund'

/**
 * `captured` → `refunded` once the refunds that did not fail cover the payment; back to
 * `captured` when a failed refund leaves part of it unreturned. Other statuses are left alone.
 * The caller holds the order's row lock.
 */
export async function syncRefundedStatus(ctx: StoreContext, paymentId: string): Promise<void> {
  const [p] = await ctx.tx
    .select({ status: payment.status, amountPaise: payment.amountPaise })
    .from(payment)
    .where(eq(payment.id, paymentId))
    .for('update')
  if (!p || (p.status !== 'captured' && p.status !== 'refunded')) return
  const back = await refundedPaise(ctx, paymentId)
  const next = back >= p.amountPaise ? 'refunded' : 'captured'
  if (next !== p.status) {
    await ctx.tx.update(payment).set({ status: next }).where(eq(payment.id, paymentId))
  }
}

/**
 * Set the matching refunds to `status`, then their payments' status and their orders'
 * statuses. Order rows are locked first (the same order as refunds and webhooks take). True
 * when a refund row changed.
 */
export async function settleRefunds(
  ctx: StoreContext,
  match: SQL,
  status: 'processed' | 'failed',
): Promise<boolean> {
  const rows = await ctx.tx
    .select({ id: refund.id, orderId: refund.orderId, paymentId: refund.paymentId })
    .from(refund)
    .where(and(match, ne(refund.status, status)))
  if (rows.length === 0) return false
  const orderIds = [...new Set(rows.map((r) => r.orderId))]
  await ctx.tx.select({ id: order.id }).from(order).where(inArray(order.id, orderIds)).for('update')
  await ctx.tx
    .update(refund)
    .set({ status })
    .where(
      inArray(
        refund.id,
        rows.map((r) => r.id),
      ),
    )
  for (const paymentId of new Set(rows.map((r) => r.paymentId))) {
    await syncRefundedStatus(ctx, paymentId)
  }
  for (const orderId of orderIds) await recomputeOrderStatuses(ctx, orderId)
  return true
}
