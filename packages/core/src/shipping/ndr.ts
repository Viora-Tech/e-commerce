import { shipment } from '@commerce/db'
import type { NdrAction, ShippingProvider, Tracking } from '@commerce/shipping'
import { and, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import type { ShipmentRow } from './shipments'

/** Shipments the courier flagged as an undelivered-delivery-attempt, waiting on the merchant. */
export async function listNdrShipments(ctx: StoreContext): Promise<ShipmentRow[]> {
  return ctx.tx
    .select()
    .from(shipment)
    .where(and(eq(shipment.storeId, ctx.storeId), eq(shipment.ndrStatus, 'pending')))
}

/**
 * Record an NDR call from the courier (webhook or manual "mark as NDR" from
 * the queue when a scan describes it but the webhook has not landed yet).
 */
export async function raiseNdr(
  ctx: StoreContext,
  shipmentId: string,
  reason: string,
): Promise<void> {
  await ctx.tx
    .update(shipment)
    .set({
      ndrStatus: 'pending',
      ndrReason: reason,
      ndrRaisedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(shipment.id, shipmentId), eq(shipment.storeId, ctx.storeId)))
}

/**
 * Tell the courier what to do about an undelivered attempt: try again, use a
 * new address, or send it back. The shipment moves to `action_taken`; the
 * next tracking scan (poll or webhook) resolves it once the courier acts.
 */
export async function applyNdrAction(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
  action: NdrAction,
  input: {
    name?: string | undefined
    phone?: string | undefined
    address?: string | undefined
    comment?: string | undefined
  } = {},
): Promise<ShipmentRow> {
  if (!provider.ndrAction) {
    throw new Error(`${provider.id} does not support NDR actions through this app.`)
  }
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')

  const result = await provider.ndrAction({ waybill: row.waybill, action, ...input })

  const [updated] = await ctx.tx
    .update(shipment)
    .set({
      ndrStatus: result.accepted ? 'action_taken' : 'pending',
      ndrAction: action,
      ndrActionAt: new Date(),
      ndrActionRef: result.providerRef ?? null,
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, shipmentId))
    .returning()
  return updated ?? row
}

/**
 * Phrases that mean "the courier tried and failed to deliver this", matched
 * case-insensitively against the latest scan's own free-text description.
 *
 * Neither courier exposes a fixed "this scan is an NDR" code over the API we
 * use: Delhivery's `StatusType` only distinguishes undelivered ('UD') from
 * delivered/RTO/cancelled and leaves the actual reason to the free-text
 * `Instructions`/`Scan` fields (see `mapDelhiveryStatus` in
 * packages/shipping-delhivery/src/delhivery.ts); Shiprocket's own support
 * docs describe the courier-reported state simply as "Undelivered" with a
 * free-text reason (support.shiprocket.in/support/solutions/articles/43000664209).
 * So this is verified-as-best-effort against both couriers' documented
 * wording and their tracking pages' own vocabulary, not a fixed enum -
 * same epistemic status as the NDR actions above, and should be widened if a
 * live account surfaces a phrasing this misses.
 */
const NDR_PHRASES = [
  'ndr',
  'non-delivery',
  'non delivery',
  'undelivered',
  'not delivered',
  'delivery attempt failed',
  'failed delivery attempt',
  'consignee not available',
  'consignee unavailable',
  'consignee refused',
  'customer refused',
  'refused to accept',
  'refused delivery',
  'address incorrect',
  'incomplete address',
  'address not found',
  'incorrect address',
  'not reachable',
  'unreachable',
  'no response from consignee',
  'cod not ready',
  'cod amount not ready',
  'door locked',
  'shop closed',
] as const

type NdrDetection = { reason: string } | null

/**
 * Read the latest scan off a fresh `Tracking` answer and say whether it
 * looks like an open NDR. Never fires for a snapshot that already reports
 * delivered/RTO/cancelled - those are resolutions, not problems, and are
 * handled by `syncNdrFromTracking` clearing any existing NDR instead.
 * Not exported: `syncNdrFromTracking` is the public entry point, and its own
 * tests exercise this through `applyTracking`.
 */
function detectNdrFromTracking(tracking: Tracking): NdrDetection {
  if (
    tracking.status === 'delivered' ||
    tracking.status === 'rto' ||
    tracking.status === 'cancelled'
  ) {
    return null
  }
  const latest = tracking.events[tracking.events.length - 1]
  const description = latest?.description?.trim()
  const text = description?.toLowerCase() ?? ''
  if (!text) return null
  const hit = NDR_PHRASES.some((phrase) => text.includes(phrase))
  return hit ? { reason: description as string } : null
}

/**
 * Wired into `applyTracking` for every fresh tracking answer (webhook or
 * poll): raises an NDR from the latest scan when one isn't already open with
 * the same reason, and resolves an open one once the courier reports
 * delivered or RTO. Idempotent - re-applying the same snapshot never
 * re-raises, re-resolves, or double-emits the outbox event, since each
 * branch only writes (and only inserts a row) when the shipment's stored
 * `ndrStatus`/`ndrReason` would actually change.
 */
export async function syncNdrFromTracking(
  ctx: StoreContext,
  current: ShipmentRow,
  tracking: Tracking,
): Promise<ShipmentRow> {
  if (tracking.status === 'delivered' || tracking.status === 'rto') {
    if (current.ndrStatus !== 'pending' && current.ndrStatus !== 'action_taken') return current
    const [updated] = await ctx.tx
      .update(shipment)
      .set({ ndrStatus: 'resolved', updatedAt: new Date() })
      .where(
        and(
          eq(shipment.id, current.id),
          eq(shipment.storeId, ctx.storeId),
          inArray(shipment.ndrStatus, ['pending', 'action_taken']),
        ),
      )
      .returning()
    if (!updated) return current
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'shipment.ndr_resolved', {
      orderId: updated.orderId,
    })
    return updated
  }

  const detection = detectNdrFromTracking(tracking)
  if (!detection) return current
  const alreadyOpenWithSameReason =
    (current.ndrStatus === 'pending' || current.ndrStatus === 'action_taken') &&
    current.ndrReason === detection.reason
  if (alreadyOpenWithSameReason) return current

  await raiseNdr(ctx, current.id, detection.reason)
  const [updated] = await ctx.tx.select().from(shipment).where(eq(shipment.id, current.id))
  if (!updated) return current
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'shipment.ndr_raised', { orderId: updated.orderId })
  return updated
}
