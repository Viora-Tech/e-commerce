import { paymentEvent } from '@commerce/db'
import { type PaymentProvider, readableError } from '@commerce/payments'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recordPaymentCharges } from './charges'
import { applyPaymentStatus, findPaymentId } from './confirm'
import { refundProcessed, settleRefund } from './refund-webhook'

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
  const verified = provider.parseWebhook(input)
  if (!verified.ok) return verified
  // A gateway whose webhook is not the last word (Snapmint) asks its own API first. A failed
  // lookup throws before anything is stored, so the gateway's retry is processed in full.
  const parsed = provider.confirmWebhookEvent
    ? { ...verified, event: await provider.confirmWebhookEvent(verified.event) }
    : verified
  // Methods sharing one gateway account (Razorpay Checkout, Razorpay UPI QR)
  // share its webhook, so one event is stored once whichever method parsed it.
  const dedupeAs = provider.webhookId ?? provider.id

  await ctx.tx
    .insert(paymentEvent)
    .values({
      storeId: ctx.storeId,
      provider: dedupeAs,
      eventId: parsed.eventId,
      type: parsed.event.type,
      payload: parsed.event.raw ?? {},
    })
    .onConflictDoNothing()
  const [row] = await ctx.tx
    .select({ id: paymentEvent.id, status: paymentEvent.status })
    .from(paymentEvent)
    .where(and(eq(paymentEvent.provider, dedupeAs), eq(paymentEvent.eventId, parsed.eventId)))
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
      // The amount invariant lives inside applyPaymentStatus now (every capture
      // path shares it); the webhook just hands it the reported amount and, if
      // refused, records why on the event.
      const r = await applyPaymentStatus(ctx, {
        providerRef: e.providerRef,
        idempotencyKey: e.idempotencyKey,
        status: e.type === 'payment.captured' ? 'captured' : 'authorized',
        providerPaymentId: e.providerPaymentId,
        capturedAmountPaise: e.amountPaise,
      })
      if (r?.rejected === 'underpaid') {
        // Kept for the merchant to look at, never applied: the order stays unpaid.
        await ctx.tx
          .update(paymentEvent)
          .set({
            status: 'processed',
            processedAt: new Date(),
            error: `amount mismatch: gateway reported ${e.amountPaise} paise, attempt is ${r.payment.amountPaise}`,
          })
          .where(eq(paymentEvent.id, row.id))
        return {
          ok: true,
          eventId: parsed.eventId,
          applied: false,
          duplicate: false,
          capturedOrderId,
        }
      }
      applied = r !== null
      if (r?.becameCaptured) capturedOrderId = r.payment.orderId
      // The gateway's fee and how the shopper paid, when the capture carries them.
      if (r && e.type === 'payment.captured' && e.charges) {
        await recordPaymentCharges(ctx.tx, r.payment.id, e.charges)
      }
    } else if (e.type === 'payment.charges') {
      const id = await findPaymentId(ctx, { providerRef: e.providerRef })
      if (id) await recordPaymentCharges(ctx.tx, id, e.charges)
      applied = id !== null
    } else if (e.type === 'payment.failed') {
      applied =
        (await applyPaymentStatus(ctx, {
          providerRef: e.providerRef,
          idempotencyKey: e.idempotencyKey,
          status: 'failed',
          providerPaymentId: e.providerPaymentId,
          // The gateway's own words (Razorpay's "website does not match…"), shown to the merchant.
          error: e.reason,
        })) !== null
    } else if (e.type === 'refund.processed') {
      applied = await refundProcessed(ctx, e)
    } else if (e.type === 'refund.failed') {
      // The gateway's reason stays on the stored payment_event; the refund keeps the merchant's own.
      applied = await settleRefund(ctx, e.providerRefundId, 'failed')
    }
    await ctx.tx
      .update(paymentEvent)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(paymentEvent.id, row.id))
  } catch (err) {
    await ctx.tx
      .update(paymentEvent)
      .set({ status: 'failed', error: readableError(err) })
      .where(eq(paymentEvent.id, row.id))
    throw err
  }
  return { ok: true, eventId: parsed.eventId, applied, duplicate: false, capturedOrderId }
}
