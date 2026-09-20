import { paymentEvent } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyPaymentStatus } from './confirm'

export type WebhookOutcome =
  | { ok: true; eventId: string; applied: boolean; duplicate: boolean }
  | { ok: false; reason: string }

/**
 * Verify, store, then process a gateway webhook. Storing first with a unique
 * (store, provider, eventId) makes retries from the gateway harmless: a
 * duplicate is acknowledged without being applied twice.
 */
export async function handlePaymentWebhook(
  ctx: StoreContext,
  provider: PaymentProvider,
  input: { rawBody: string; headers: Record<string, string | undefined> },
): Promise<WebhookOutcome> {
  const parsed = provider.parseWebhook(input)
  if (!parsed.ok) return parsed

  const [existing] = await ctx.tx
    .select({ id: paymentEvent.id, status: paymentEvent.status })
    .from(paymentEvent)
    .where(and(eq(paymentEvent.provider, provider.id), eq(paymentEvent.eventId, parsed.eventId)))
  if (existing?.status === 'processed') {
    return { ok: true, eventId: parsed.eventId, applied: false, duplicate: true }
  }

  const [row] = existing
    ? [existing]
    : await ctx.tx
        .insert(paymentEvent)
        .values({
          storeId: ctx.storeId,
          provider: provider.id,
          eventId: parsed.eventId,
          type: parsed.event.type,
          payload: parsed.event.raw ?? {},
        })
        .returning({ id: paymentEvent.id, status: paymentEvent.status })
  if (!row) throw new Error('payment_event insert returned nothing')

  let applied = false
  try {
    const e = parsed.event
    if (e.type === 'payment.captured' || e.type === 'payment.authorized') {
      applied =
        (await applyPaymentStatus(ctx, {
          providerRef: e.providerRef,
          status: e.type === 'payment.captured' ? 'captured' : 'authorized',
          providerPaymentId: e.providerPaymentId,
        })) !== null
    } else if (e.type === 'payment.failed') {
      applied =
        (await applyPaymentStatus(ctx, {
          providerRef: e.providerRef,
          status: 'failed',
          providerPaymentId: e.providerPaymentId,
        })) !== null
    } else if (e.type === 'refund.processed') {
      applied =
        (await applyPaymentStatus(ctx, {
          providerRef: e.providerRef,
          status: 'refunded',
          providerPaymentId: null,
        })) !== null
    }
    await ctx.tx
      .update(paymentEvent)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(paymentEvent.id, row.id))
  } catch (err) {
    await ctx.tx
      .update(paymentEvent)
      .set({ status: 'failed', error: err instanceof Error ? err.message : String(err) })
      .where(eq(paymentEvent.id, row.id))
    throw err
  }
  return { ok: true, eventId: parsed.eventId, applied, duplicate: false }
}
