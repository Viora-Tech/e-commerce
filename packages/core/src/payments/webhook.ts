import { paymentEvent } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyPaymentStatus } from './confirm'

export type WebhookOutcome =
  | {
      ok: true
      eventId: string
      applied: boolean
      duplicate: boolean
      /** Set when this event moved a payment to captured; the caller enqueues the notification. */
      capturedOrderId: string | null
    }
  | { ok: false; reason: string }

/**
 * Verify, store, then process a gateway webhook. Storing first with a unique
 * (store, provider, eventId) makes retries from the gateway harmless: a
 * duplicate is acknowledged without being applied twice. Two deliveries of one
 * event racing each other meet on that unique index: the second insert waits
 * for the first transaction, then finds the event processed.
 */
export async function handlePaymentWebhook(
  ctx: StoreContext,
  provider: PaymentProvider,
  input: { rawBody: string; headers: Record<string, string | undefined> },
): Promise<WebhookOutcome> {
  const parsed = provider.parseWebhook(input)
  if (!parsed.ok) return parsed

  await ctx.tx
    .insert(paymentEvent)
    .values({
      storeId: ctx.storeId,
      provider: provider.id,
      eventId: parsed.eventId,
      type: parsed.event.type,
      payload: parsed.event.raw ?? {},
    })
    .onConflictDoNothing()
  const [row] = await ctx.tx
    .select({ id: paymentEvent.id, status: paymentEvent.status })
    .from(paymentEvent)
    .where(and(eq(paymentEvent.provider, provider.id), eq(paymentEvent.eventId, parsed.eventId)))
    .for('update')
  if (!row) throw new Error('payment_event row missing after insert')
  if (row.status === 'processed') {
    return {
      ok: true,
      eventId: parsed.eventId,
      applied: false,
      duplicate: true,
      capturedOrderId: null,
    }
  }

  let applied = false
  let capturedOrderId: string | null = null
  try {
    const e = parsed.event
    if (e.type === 'payment.captured' || e.type === 'payment.authorized') {
      const r = await applyPaymentStatus(ctx, {
        providerRef: e.providerRef,
        idempotencyKey: e.idempotencyKey,
        status: e.type === 'payment.captured' ? 'captured' : 'authorized',
        providerPaymentId: e.providerPaymentId,
      })
      applied = r !== null
      if (r?.becameCaptured) capturedOrderId = r.payment.orderId
    } else if (e.type === 'payment.failed') {
      applied =
        (await applyPaymentStatus(ctx, {
          providerRef: e.providerRef,
          idempotencyKey: e.idempotencyKey,
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
  return { ok: true, eventId: parsed.eventId, applied, duplicate: false, capturedOrderId }
}
