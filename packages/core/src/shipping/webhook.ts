import { shipment, shipmentWebhookEvent } from '@commerce/db'
import type { ShippingProvider, WebhookRequest } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyTracking } from './shipments'

export type ShipmentWebhookOutcome = {
  ok: boolean
  reason?: string
  /** One entry per AWB the call mentioned that we hold a shipment for. */
  applied: { waybill: string; duplicate: boolean }[]
}

/**
 * Handle one inbound tracking webhook call: verify it, record every AWB it
 * mentions for dedupe (idempotent per `(store, provider, eventId)`, same
 * pattern as `payment_event`), then re-fetch and apply full tracking for
 * each one rather than trust the pushed payload's shape - see
 * `DelhiveryProvider.parseWebhook` for why.
 *
 * Must run inside `withStore`. Each AWB's `applyTracking` writes its own
 * outbox events (via `recomputeOrderStatuses`) in the same transaction, so a
 * webhook call that updates three orders' fulfilment status either commits
 * all three outbox rows or none of them.
 */
export async function handleShipmentWebhook(
  ctx: StoreContext,
  provider: ShippingProvider,
  request: WebhookRequest,
): Promise<ShipmentWebhookOutcome> {
  if (!provider.parseWebhook) {
    return { ok: false, reason: `${provider.id} does not support tracking webhooks`, applied: [] }
  }
  const notices = await provider.parseWebhook(request)
  if (notices.length === 0) return { ok: true, applied: [] }

  const applied: { waybill: string; duplicate: boolean }[] = []
  for (const notice of notices) {
    const [inserted] = await ctx.tx
      .insert(shipmentWebhookEvent)
      .values({
        storeId: ctx.storeId,
        provider: provider.id,
        eventId: notice.eventId,
        waybill: notice.waybill,
        payload: notice,
      })
      .onConflictDoNothing({
        target: [
          shipmentWebhookEvent.storeId,
          shipmentWebhookEvent.provider,
          shipmentWebhookEvent.eventId,
        ],
      })
      .returning({ id: shipmentWebhookEvent.id })
    if (!inserted) {
      applied.push({ waybill: notice.waybill, duplicate: true })
      continue
    }

    const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.waybill, notice.waybill))
    if (!row || row.storeId !== ctx.storeId || row.provider !== provider.id) {
      await ctx.tx
        .update(shipmentWebhookEvent)
        .set({ status: 'failed', error: 'no matching shipment', processedAt: new Date() })
        .where(eq(shipmentWebhookEvent.id, inserted.id))
      applied.push({ waybill: notice.waybill, duplicate: false })
      continue
    }
    try {
      const tracking = await provider.track(notice.waybill)
      await applyTracking(ctx, row.id, tracking)
      await ctx.tx
        .update(shipmentWebhookEvent)
        .set({ status: 'processed', processedAt: new Date() })
        .where(eq(shipmentWebhookEvent.id, inserted.id))
    } catch (err) {
      await ctx.tx
        .update(shipmentWebhookEvent)
        .set({
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          processedAt: new Date(),
        })
        .where(eq(shipmentWebhookEvent.id, inserted.id))
    }
    applied.push({ waybill: notice.waybill, duplicate: false })
  }
  return { ok: true, applied }
}
