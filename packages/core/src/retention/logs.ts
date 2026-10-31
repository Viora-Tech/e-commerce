/** SOURCE OF TRUTH: Log retention — WHAT: dispatched outbox rows are deleted after 30 days; Search & discovery events after 90 days; gateway and courier webhook payloads are emptied after 180 days, keeping each row / WHY: the outbox only grows, and the raw payloads hold shoppers' emails, phones, card digits and addresses, which the DPDP Act says to keep only as long as needed (180 days covers disputes) */
import {
  discoveryEvent,
  outboxEvent,
  paymentEvent,
  type StoreTx,
  shipmentWebhookEvent,
} from '@commerce/db'
import { and, inArray, lt, sql } from 'drizzle-orm'
import { DISCOVERY_RETENTION_DAYS } from '../discovery/query'

/** Dispatched outbox rows are kept this long (consumers read a row within minutes of dispatch). */
const OUTBOX_RETENTION_DAYS = 30
/** Webhook payloads are kept this long; the row (ids, type, status, error, times) stays for dedupe and history. */
const WEBHOOK_PAYLOAD_RETENTION_DAYS = 180

const DAY_MS = 86_400_000
/** Only settled events are emptied; a pending one may still be processed. */
const SETTLED = ['processed', 'failed'] as const

/** Delete up to `limit` outbox rows dispatched over 30 days ago; returns how many. Undispatched rows are never touched. */
export async function deleteDispatchedOutboxBatch(
  tx: StoreTx,
  now: Date,
  limit: number,
): Promise<number> {
  const cutoff = new Date(now.getTime() - OUTBOX_RETENTION_DAYS * DAY_MS)
  const due = tx
    .select({ id: outboxEvent.id })
    .from(outboxEvent)
    .where(lt(outboxEvent.dispatchedAt, cutoff))
    .limit(limit)
    .for('update', { skipLocked: true })
  const rows = await tx
    .delete(outboxEvent)
    .where(inArray(outboxEvent.id, due))
    .returning({ id: outboxEvent.id })
  return rows.length
}

/**
 * Empty the payload (`{}`) of up to `limit` processed or failed gateway webhooks received over
 * 180 days ago; returns how many. The order page's payment history finds events by the gateway
 * ids inside the payload, so an emptied event no longer shows there.
 */
export async function scrubPaymentEventBatch(
  tx: StoreTx,
  now: Date,
  limit: number,
): Promise<number> {
  const cutoff = new Date(now.getTime() - WEBHOOK_PAYLOAD_RETENTION_DAYS * DAY_MS)
  const due = tx
    .select({ id: paymentEvent.id })
    .from(paymentEvent)
    .where(
      and(
        inArray(paymentEvent.status, [...SETTLED]),
        lt(paymentEvent.receivedAt, cutoff),
        sql`${paymentEvent.payload} <> '{}'::jsonb`,
      ),
    )
    .limit(limit)
    .for('update', { skipLocked: true })
  const rows = await tx
    .update(paymentEvent)
    .set({ payload: {} })
    .where(inArray(paymentEvent.id, due))
    .returning({ id: paymentEvent.id })
  return rows.length
}

/** The same for courier tracking webhooks (`waybill` and `event_id` stay as columns). */
export async function scrubShipmentWebhookEventBatch(
  tx: StoreTx,
  now: Date,
  limit: number,
): Promise<number> {
  const cutoff = new Date(now.getTime() - WEBHOOK_PAYLOAD_RETENTION_DAYS * DAY_MS)
  const due = tx
    .select({ id: shipmentWebhookEvent.id })
    .from(shipmentWebhookEvent)
    .where(
      and(
        inArray(shipmentWebhookEvent.status, [...SETTLED]),
        lt(shipmentWebhookEvent.receivedAt, cutoff),
        sql`${shipmentWebhookEvent.payload} <> '{}'::jsonb`,
      ),
    )
    .limit(limit)
    .for('update', { skipLocked: true })
  const rows = await tx
    .update(shipmentWebhookEvent)
    .set({ payload: {} })
    .where(inArray(shipmentWebhookEvent.id, due))
    .returning({ id: shipmentWebhookEvent.id })
  return rows.length
}

/** Delete up to `limit` search and recommendation events over 90 days old; returns how many. */
export async function deleteOldDiscoveryEventBatch(
  tx: StoreTx,
  now: Date,
  limit: number,
): Promise<number> {
  const cutoff = new Date(now.getTime() - DISCOVERY_RETENTION_DAYS * DAY_MS)
  const due = tx
    .select({ id: discoveryEvent.id })
    .from(discoveryEvent)
    .where(lt(discoveryEvent.createdAt, cutoff))
    .limit(limit)
    .for('update', { skipLocked: true })
  const rows = await tx
    .delete(discoveryEvent)
    .where(inArray(discoveryEvent.id, due))
    .returning({ id: discoveryEvent.id })
  return rows.length
}
