/** SOURCE OF TRUTH: capture an authorised payment — WHAT: the order page's "Capture payment" (#150): asks the gateway to take the money a manual-capture checkout only authorised, then records the capture like any other / WHY: one place checks the payment is this store's, still authorised and the gateway can capture */
import { order, payment } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { applyPaymentStatus } from '../payments/confirm'

class CaptureNotAllowed extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('CAPTURE_NOT_ALLOWED', message, { storeId })
  }
}

/**
 * Capture an authorised payment in full. The order, then the payment, are locked first (the
 * order `applyPaymentStatus` and refunds lock in), so a webhook arriving meanwhile waits and
 * then sees the capture. Returns what `applyPaymentStatus` recorded.
 */
export async function capturePayment(
  ctx: StoreContext,
  provider: PaymentProvider | null,
  paymentId: string,
) {
  const [head] = await ctx.tx
    .select({ orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.id, paymentId))
  if (!head) throw new CaptureNotAllowed('Payment not found', ctx.storeId)
  await ctx.tx.select({ id: order.id }).from(order).where(eq(order.id, head.orderId)).for('update')
  const [p] = await ctx.tx.select().from(payment).where(eq(payment.id, paymentId)).for('update')
  if (!p) throw new CaptureNotAllowed('Payment not found', ctx.storeId)
  if (p.status !== 'authorized') {
    throw new CaptureNotAllowed('Only an authorised payment can be captured', ctx.storeId)
  }
  if (!provider?.capture) {
    throw new CaptureNotAllowed(`${p.provider} cannot capture payments from here`, ctx.storeId)
  }
  if (!p.providerPaymentId) {
    throw new CaptureNotAllowed('The gateway has not reported a payment id yet', ctx.storeId)
  }
  const r = await provider.capture(p.providerPaymentId, p.amountPaise)
  return applyPaymentStatus(ctx, {
    paymentId: p.id,
    status: r.status,
    providerPaymentId: r.providerPaymentId,
  })
}
