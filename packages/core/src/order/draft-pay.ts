import { order, payment } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { createPaymentAttempt } from '../payments/attempts'
import { convertDraft } from './drafts'

/**
 * The customer pays a draft invoice online: the draft becomes an order on that gateway (stock
 * held, GST billed, exactly as the admin's convert), and gets a fresh payment attempt for its
 * total, ready to start with the gateway. The convert's placeholder "pending" payment is
 * replaced by the attempt, so retries and the webhook see a normal online order.
 * Throws what `convertDraft` throws (out of stock, not a draft, empty).
 */
export async function convertDraftForOnlinePayment(
  ctx: StoreContext,
  draftId: string,
  providerId: string,
): Promise<{ orderId: string; orderNumber: number; attemptId: string } | null> {
  const converted = await convertDraft(ctx, draftId, { paymentMethod: providerId })
  if (!converted) return null
  await ctx.tx
    .delete(payment)
    .where(and(eq(payment.orderId, draftId), eq(payment.providerRef, `draft_${draftId}`)))
  const [o] = await ctx.tx
    .select({ number: order.number, totalPaise: order.totalPaise })
    .from(order)
    .where(eq(order.id, draftId))
  if (!o) return null
  const attempt = await createPaymentAttempt(ctx, {
    orderId: draftId,
    provider: providerId,
    amountPaise: o.totalPaise,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId: draftId })
  return { orderId: draftId, orderNumber: o.number, attemptId: attempt.id }
}
