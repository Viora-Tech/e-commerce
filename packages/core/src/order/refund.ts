import { order, payment, refund } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, ne, sum } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { changeGiftCardBalance, GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { recomputeOrderStatuses } from './recompute'

export type RefundInput = {
  paymentId: string
  amountPaise: number
  reason?: string | undefined
}

export class RefundNotAllowed extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('REFUND_NOT_ALLOWED', message, { storeId })
  }
}

/**
 * Methods settled outside the platform: the merchant hands the money back
 * over UPI or cash, and the row only records that it happened.
 */
const OFFLINE_PROVIDERS = new Set(['cod', 'manual'])

/** Paise already refunded on a payment, across every recorded refund that did not fail. */
export async function refundedPaise(ctx: StoreContext, paymentId: string): Promise<number> {
  const [row] = await ctx.tx
    .select({ total: sum(refund.amountPaise) })
    .from(refund)
    .where(and(eq(refund.paymentId, paymentId), ne(refund.status, 'failed')))
  return Number(row?.total ?? 0)
}

/**
 * Refund part or all of a captured payment. The gateway is asked first so a
 * declined refund never leaves a row claiming the money went back; offline
 * methods skip the gateway and are recorded as `manual`. When the whole
 * capture is returned the payment flips to `refunded`.
 */
export async function refundPayment(
  ctx: StoreContext,
  provider: PaymentProvider | null,
  input: RefundInput,
) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new RefundNotAllowed('Refund amount must be a positive whole number of paise')
  }
  /* Lock the payment until the transaction ends, so two refunds of one payment
     run one after the other and the second sees the first in its total. Without
     it both read the same refunded sum and together return more than was
     captured. Pattern from Medusa's lock-then-recheck (MIT). */
  const [head] = await ctx.tx
    .select({ orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.id, input.paymentId))
  if (!head) throw new RefundNotAllowed('Payment not found')
  /* Order first, then payment: the same lock order as applyPaymentStatus, so a
     refund racing a webhook on the same order waits instead of deadlocking. */
  await ctx.tx.select({ id: order.id }).from(order).where(eq(order.id, head.orderId)).for('update')
  const [p] = await ctx.tx
    .select()
    .from(payment)
    .where(eq(payment.id, input.paymentId))
    .for('update')
  if (!p) throw new RefundNotAllowed('Payment not found')
  if (p.status !== 'captured' && p.status !== 'refunded') {
    throw new RefundNotAllowed('Only captured payments can be refunded')
  }
  const already = await refundedPaise(ctx, p.id)
  const remaining = p.amountPaise - already
  if (input.amountPaise > remaining) {
    throw new RefundNotAllowed(`Only ${remaining} paise left to refund on this payment`)
  }

  const offline = OFFLINE_PROVIDERS.has(p.provider)
  const toGiftCard = p.provider === GIFT_CARD_PROVIDER
  let status: 'pending' | 'processed' | 'manual' = 'manual'
  let providerRefundId: string | null = null
  if (toGiftCard) {
    // Money paid from a gift card goes back onto the same card.
    if (!p.providerPaymentId) throw new RefundNotAllowed('Gift card payment has no card')
    status = 'processed'
    providerRefundId = p.providerPaymentId
  } else if (!offline) {
    if (!provider) throw new RefundNotAllowed(`Payment provider ${p.provider} is not installed`)
    if (!p.providerPaymentId) {
      throw new RefundNotAllowed('Gateway has not reported a payment id for this payment yet')
    }
    const r = await provider.refund(p.providerPaymentId, input.amountPaise, input.reason, {
      providerRef: p.providerRef,
      refundKey: `rf_${p.id.replace(/-/g, '').slice(0, 20)}_${already}`,
    })
    status = r.status
    providerRefundId = r.providerRefundId
  }

  const [row] = await ctx.tx
    .insert(refund)
    .values({
      storeId: ctx.storeId,
      orderId: p.orderId,
      paymentId: p.id,
      amountPaise: input.amountPaise,
      reason: input.reason ?? null,
      status,
      providerRefundId,
    })
    .returning()
  if (toGiftCard && row && p.providerPaymentId) {
    await changeGiftCardBalance(ctx, {
      giftCardId: p.providerPaymentId,
      amountPaise: input.amountPaise,
      kind: 'refund',
      orderId: p.orderId,
      paymentId: p.id,
      note: input.reason,
    })
  }
  if (already + input.amountPaise >= p.amountPaise) {
    await ctx.tx.update(payment).set({ status: 'refunded' }).where(eq(payment.id, p.id))
  }
  await recomputeOrderStatuses(ctx, p.orderId)
  return row ?? null
}
