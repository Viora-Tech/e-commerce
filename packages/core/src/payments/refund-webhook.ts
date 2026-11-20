/** SOURCE OF TRUTH: refund webhooks — WHAT: refund.processed / refund.failed from a gateway: settle our own refund row, or record a refund made on the gateway's dashboard as a row of its own (deduped by the gateway refund id) with a timeline note / WHY: order payment status and amounts are derived from refund rows, so a dashboard refund without a row left the order reading paid (#1790) */
import { order, orderNote, payment, refund } from '@commerce/db'
import type { WebhookEvent } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recomputeOrderStatuses } from '../order/recompute'
import { refundedPaise } from '../order/refund'
import { settleRefunds, syncRefundedStatus } from './refund-settle'

/** Shown on the refund row, so staff can tell it was not made from Koomerce. */
export const GATEWAY_REFUND_REASON = 'Refunded on the payment gateway'

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Record what the gateway finally did with a refund we asked for. A failed one stops counting
 * as refunded (recompute reads refunds that are not `failed`), so the order and its return no
 * longer say the money went back when it did not. True when a refund row changed.
 */
export function settleRefund(
  ctx: StoreContext,
  providerRefundId: string,
  status: 'processed' | 'failed',
): Promise<boolean> {
  if (!providerRefundId) return Promise.resolve(false)
  return settleRefunds(ctx, eq(refund.providerRefundId, providerRefundId), status)
}

async function hasRow(ctx: StoreContext, providerRefundId: string): Promise<boolean> {
  const [row] = await ctx.tx
    .select({ id: refund.id })
    .from(refund)
    .where(eq(refund.providerRefundId, providerRefundId))
    .limit(1)
  return Boolean(row)
}

/**
 * A refund the gateway completed. Ours: its row turns processed, and the payment reads
 * `refunded` once all of it went back. Not ours (made on the gateway's dashboard): recorded as
 * a processed refund row of its own, whole or part, never more than is left on the payment,
 * with a note on the order's timeline. True when something was recorded.
 */
export async function refundProcessed(
  ctx: StoreContext,
  e: Extract<WebhookEvent, { type: 'refund.processed' }>,
): Promise<boolean> {
  if (!e.providerRefundId) return false
  if (await hasRow(ctx, e.providerRefundId)) {
    await settleRefund(ctx, e.providerRefundId, 'processed')
    return true
  }
  const [head] = await ctx.tx
    .select({ id: payment.id, orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.providerRef, e.providerRef))
    .limit(1)
  if (!head) return false
  // Order then payment, the lock order refundPayment takes: a refund of ours still being
  // committed is waited for, then found below instead of recorded twice.
  await ctx.tx.select({ id: order.id }).from(order).where(eq(order.id, head.orderId)).for('update')
  const [p] = await ctx.tx
    .select()
    .from(payment)
    .where(eq(payment.id, head.id))
    .for('update')
  if (!p) return false
  if (await hasRow(ctx, e.providerRefundId)) {
    await settleRefund(ctx, e.providerRefundId, 'processed')
    return true
  }
  if (p.status !== 'captured' && p.status !== 'refunded') return false
  const left = p.amountPaise - (await refundedPaise(ctx, p.id))
  const amountPaise = Math.min(Math.round(e.amountPaise), left)
  if (amountPaise <= 0) return false

  await ctx.tx.insert(refund).values({
    storeId: ctx.storeId,
    orderId: p.orderId,
    paymentId: p.id,
    amountPaise,
    reason: GATEWAY_REFUND_REASON,
    status: 'processed',
    providerRefundId: e.providerRefundId,
    method: null,
    giftCardId: null,
  })
  await syncRefundedStatus(ctx, p.id)
  await recomputeOrderStatuses(ctx, p.orderId)
  const capped = amountPaise < e.amountPaise ? ` (the gateway reported ${rupees(e.amountPaise)})` : ''
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: p.orderId,
    body: `Refund of ${rupees(amountPaise)}${capped} made on the payment gateway, not from Koomerce. Recorded from the gateway's webhook (refund ${e.providerRefundId}).`,
    author: 'system',
  })
  return true
}
