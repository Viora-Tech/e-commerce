/** SOURCE OF TRUTH: payOnlineInstead — WHAT: a transfer or cash on delivery order's shopper switches to a gateway, under the order's row lock / WHY: one attempt per switch, and the merchant's reminders keep working */

import { type Db, order, orderNote, payment, withStore } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { PaymentProvider } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { capturedPaise } from '../order/aggregate-status'
import { isOpenCheckoutDraft } from '../order/checkout-draft'
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
 *
 * Cash on delivery (owner, 13 Nov 2026): staff can ask a COD shopper to pay online ("Ask to pay
 * online", e.g. no courier takes COD to the PIN), and the order page offers the same switch. The
 * open `cod` attempt, if any, is cancelled and a gateway attempt opens for what is still due (the
 * total less anything captured; a COD fee stays in it). The order keeps `payment_method = 'cod'`
 * until the money arrives, so an abandoned gateway window never makes it an online order the
 * unpaid expiry would cancel; the capture turns it prepaid (`order/recompute.ts`). Nothing that
 * has already been packed or shipped as COD switches: the courier would still collect cash.
 */

const OPEN: readonly string[] = OPEN_ATTEMPT_STATUSES

const COD_METHOD = 'cod'

const COD_PAY_ONLINE_NOTE = (gateway: string) =>
  `The customer chose to pay online with ${gateway} instead of cash on delivery.`

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
  // A UPI / bank transfer checkout kept as a draft (#D57) switches the same way.
  if (o.status !== 'open' && !isOpenCheckoutDraft(o)) {
    throw new PaymentNotRetryable(orderId, o.status, ctx.storeId)
  }
  if (o.checkoutPaidAt) throw new PaymentNotRetryable(orderId, 'already paid', ctx.storeId)
  if (o.paymentMethod === COD_METHOD) return switchCodToOnline(ctx, o, provider)
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

/**
 * A cash on delivery order's switch: the open `cod` attempt (if any) cancelled, a gateway attempt
 * for what is still due. Called under the order's row lock. A second tap finds the gateway
 * attempt open and gets it back.
 */
async function switchCodToOnline(
  ctx: StoreContext,
  o: typeof order.$inferSelect,
  provider: { id: string; label: string },
): Promise<{ attempt: PaymentAttempt; created: boolean }> {
  if (o.importedFrom) throw new PaymentNotRetryable(o.id, 'imported', ctx.storeId)
  // Packed or on its way as cash on delivery: the courier collects at the door.
  if (o.fulfillmentStatus !== 'unfulfilled') {
    throw new PaymentNotRetryable(o.id, 'already packed as cash on delivery', ctx.storeId)
  }
  const all = (
    await ctx.tx
      .select({
        status: payment.status,
        amountPaise: payment.amountPaise,
        refundNeeded: payment.refundNeeded,
        purpose: payment.purpose,
      })
      .from(payment)
      .where(eq(payment.orderId, o.id))
  ).filter((p) => p.purpose === 'order')
  const duePaise = o.totalPaise - capturedPaise(all.map((p) => ({ ...p, refundedPaise: 0 })))
  if (duePaise <= 0) throw new PaymentNotRetryable(o.id, 'already paid', ctx.storeId)
  const attempts = (await paymentAttempts(ctx, o.id)).filter((a) => a.purpose === 'order')
  const latest = attempts[0]
  if (latest && latest.provider === provider.id && OPEN.includes(latest.status)) {
    return { attempt: latest, created: false }
  }
  // As the unpaid expiry ends an attempt; nobody collects cash for this order any more.
  for (const a of attempts) {
    if (a.provider === COD_METHOD && OPEN.includes(a.status)) {
      await ctx.tx
        .update(payment)
        .set({ status: 'cancelled', error: 'Customer chose to pay online' })
        .where(eq(payment.id, a.id))
    }
  }
  const attempt = await createPaymentAttempt(ctx, {
    orderId: o.id,
    provider: provider.id,
    amountPaise: duePaise,
  })
  await recomputeOrderStatuses(ctx, o.id)
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: o.id,
    body: COD_PAY_ONLINE_NOTE(provider.label),
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
