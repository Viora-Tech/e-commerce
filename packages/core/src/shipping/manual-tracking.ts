/** SOURCE OF TRUTH: manual tracking — WHAT: the merchant moves a shipment's status by hand for a courier with no tracking feed (India Post) / WHY: the poll job has nothing to ask, but the order must still go delivered and the shopper's timeline must still grow */
import { shipment } from '@commerce/db'
import type { ShipmentStatus, Tracking, TrackingEvent } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { applyTracking, type ShipmentRow } from './shipments'

export type ManualTrackingInput = {
  status: Exclude<ShipmentStatus, 'cancelled'>
  /** What the merchant read on the courier's tracker, or our wording for the status. */
  description: string
  location?: string | undefined
  /** ISO instant; defaults to now. */
  at?: string | undefined
}

/**
 * Append one event to the shipment's timeline and apply it like a courier scan: the order goes
 * delivered, an RTO opens its task, out-for-delivery notifies the shopper (all in
 * `applyTracking`). Refuses a cancelled shipment; the caller checks the courier tracks manually.
 */
export async function recordManualTracking(
  ctx: StoreContext,
  shipmentId: string,
  input: ManualTrackingInput,
  now: Date = new Date(),
): Promise<{ shipment: ShipmentRow; becameDelivered: boolean }> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  if (row.status === 'cancelled') throw new Error('This shipment was cancelled.')
  const before = (row.tracking ?? null) as Tracking | null
  const event: TrackingEvent = {
    at: input.at ?? now.toISOString(),
    status: input.status,
    description: input.description.trim(),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
  }
  const events = [...(before?.events ?? []), event].sort((a, b) => a.at.localeCompare(b.at))
  const tracking: Tracking = {
    waybill: row.waybill,
    // The latest event decides, so a back-dated entry never rewinds a newer status.
    status: (events.at(-1) as TrackingEvent).status,
    events,
    ...(row.trackingUrl ? { trackingUrl: row.trackingUrl } : {}),
  }
  return applyTracking(ctx, shipmentId, tracking)
}
