import { payment, refund } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, ne, sum } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

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
  const [p] = await ctx.tx.select().from(payment).where(eq(payment.id, input.paymentId))
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
  let status: 'pending' | 'processed' | 'manual' = 'manual'
  let providerRefundId: string | null = null
  if (!offline) {
    if (!provider) throw new RefundNotAllowed(`Payment provider ${p.provider} is not installed`)
    if (!p.providerPaymentId) {
      throw new RefundNotAllowed('Gateway has not reported a payment id for this payment yet')
    }
    const r = await provider.refund(p.providerPaymentId, input.amountPaise, input.reason)
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
  if (already + input.amountPaise >= p.amountPaise) {
    await ctx.tx.update(payment).set({ status: 'refunded' }).where(eq(payment.id, p.id))
  }
  return row ?? null
}
