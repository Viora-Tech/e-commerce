/** SOURCE OF TRUTH: payOnlineInstead — WHAT: a transfer order's shopper switches to a gateway, under the order's row lock / WHY: one attempt per switch, and the merchant's reminders keep working */
import { type Db, order, orderNote, payment, withStore } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { PaymentProvider } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { retaxOrder } from '../order/edit-stock'
import { recomputeOrderStatuses } from '../order/recompute'
import {
  attemptSnapshot,
  createPaymentAttempt,
  type PaymentAttempt,
  PaymentNotRetryable,
  paymentAttempts,
  type StartedPayment,
  startPaymentAttempt,
} from './attempts'
import { MANUAL_METHOD } from './manual-followup'
import { OPEN_ATTEMPT_STATUSES } from './transitions'

/*
 * "Pay online instead" (issue 1010): a shopper whose order waits on a UPI or bank transfer to
 * the shop pays through the store's gateway instead, from the order page the payment reminder
 * links to. The open transfer attempt is cancelled and a gateway attempt opens for the same
 * amount, so the webhook, "Retry payment" and the admin's "Mark as paid" all see one open
 * attempt. The order keeps `payment_method = 'manual'`, so it stays out of the online orders'
 * unpaid expiry (an old transfer order would otherwise be cancelled on the next sweep) and the
 * merchant's reminders keep working; a timeline note records the switch.
 *
 * A discount for paying by transfer goes with the transfer: it exists because the money skips
 * the gateway's fee, and this payment no longer does. The total, the GST and the parcels are
 * worked out again without it, and the gateway attempt asks for the higher amount. A fee on the
 * way to pay stays, since it is not a reward for avoiding the gateway.
 */

const OPEN: readonly string[] = OPEN_ATTEMPT_STATUSES

const PAY_ONLINE_NOTE = (gateway: string, removedPaise: number) =>
  `The customer chose to pay online with ${gateway} instead of a transfer.${
    removedPaise > 0
      ? ` The transfer discount of ${formatMoney(removedPaise, 'INR')} was removed.`
      : ''
  }`

/**
 * Switch a transfer order's open attempt to `providerId`, under the order's row lock. Two taps
 * make one gateway attempt: the second finds it open and gets it back.
 */
async function switchToOnlinePayment(
  ctx: StoreContext,
  orderId: string,
  provider: { id: string; label: string },
): Promise<{ attempt: PaymentAttempt; created: boolean }> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) throw new PaymentNotRetryable(orderId, 'not found', ctx.storeId)
  if (o.status !== 'open') throw new PaymentNotRetryable(orderId, o.status, ctx.storeId)
  if (o.checkoutPaidAt) throw new PaymentNotRetryable(orderId, 'already paid', ctx.storeId)
  if (o.paymentMethod !== MANUAL_METHOD) {
    throw new PaymentNotRetryable(orderId, 'not a transfer order', ctx.storeId)
  }
  const attempts = (await paymentAttempts(ctx, orderId)).filter((a) => a.purpose === 'order')
  if (attempts.some((a) => a.status === 'captured' && !a.refundNeeded)) {
    throw new PaymentNotRetryable(orderId, 'already paid', ctx.storeId)
  }
  const latest = attempts[0]
  if (!latest) throw new PaymentNotRetryable(orderId, 'no payment to switch', ctx.storeId)
  if (latest.provider === provider.id && OPEN.includes(latest.status)) {
    return { attempt: latest, created: false }
  }
  let removedPaise = 0
  if (latest.provider === MANUAL_METHOD && OPEN.includes(latest.status)) {
    // As the unpaid expiry ends an attempt; the gateway attempt below keeps the order open.
    await ctx.tx
      .update(payment)
      .set({ status: 'cancelled', error: 'Customer chose to pay online' })
      .where(eq(payment.id, latest.id))
    removedPaise = Math.max(0, -o.paymentAdjustmentPaise)
    if (removedPaise > 0) {
      await ctx.tx
        .update(order)
        .set({
          paymentAdjustmentPaise: 0,
          paymentAdjustmentLabel: null,
          totalPaise: o.totalPaise + removedPaise,
        })
        .where(eq(order.id, orderId))
      await retaxOrder(ctx, orderId)
    }
  }
  const attempt = await createPaymentAttempt(ctx, {
    orderId,
    provider: provider.id,
    amountPaise: latest.amountPaise + removedPaise,
  })
  await recomputeOrderStatuses(ctx, orderId)
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: PAY_ONLINE_NOTE(provider.label, removedPaise),
    author: 'system',
  })
  return { attempt, created: true }
}

/** `switchToOnlinePayment`, committed, then the gateway attempt started. */
export async function payOnlineInstead(
  db: Db,
  storeId: string,
  orderId: string,
  provider: PaymentProvider,
): Promise<StartedPayment> {
  const { attempt } = await withStore(db, storeId, (tx) =>
    switchToOnlinePayment({ storeId, tx }, orderId, provider),
  )
  if (attempt.status !== 'created') return attemptSnapshot(attempt)
  return startPaymentAttempt(db, storeId, attempt.id, provider)
}
