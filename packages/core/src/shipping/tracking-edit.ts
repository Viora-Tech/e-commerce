/** SOURCE OF TRUTH: editing a shipment's tracking — WHAT: the merchant corrects a hand-entered shipment's tracking number, courier or tracking link; the order timeline records it and the shopper gets `shipping_update` / WHY: a typo'd AWB or a parcel handed to a different courier left the shopper tracking the wrong number */
import { orderNote, shipment } from '@commerce/db'
import { and, eq, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import type { ShipmentRow } from './shipments'

export type ShipmentTrackingEdit = {
  waybill: string
  /** The courier that carries it ("Blue Dart"); empty clears it. */
  courier?: string | undefined
  /** The courier's tracking page for this parcel; empty clears it. */
  trackingUrl?: string | undefined
}

export class TrackingEditRefused extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('TRACKING_EDIT_REFUSED', message, { storeId })
  }
}

/** "AWB A1 → B2, courier none → Blue Dart" for the timeline. */
function changeNote(before: ShipmentRow, after: ShipmentRow): string {
  const parts: string[] = []
  if (before.waybill !== after.waybill) parts.push(`AWB ${before.waybill} → ${after.waybill}`)
  if ((before.carrier ?? '') !== (after.carrier ?? '')) {
    parts.push(`courier ${before.carrier || 'none'} → ${after.carrier || 'none'}`)
  }
  if ((before.trackingUrl ?? '') !== (after.trackingUrl ?? '')) parts.push('tracking link changed')
  return `Tracking changed: ${parts.join(', ')}.`
}

/**
 * Save new tracking details on a shipment the merchant entered by hand (the caller checks no
 * courier app owns it). Nothing happens when nothing changed. A cancelled shipment, or an AWB
 * another shipment of the same courier already uses, is refused. Writes the timeline line and
 * `shipment.tracking_updated`, which tells the shopper once they had the shipped message.
 */
export async function updateShipmentTracking(
  ctx: StoreContext,
  shipmentId: string,
  input: ShipmentTrackingEdit,
  author: string,
): Promise<{ shipment: ShipmentRow; changed: boolean }> {
  const [before] = await ctx.tx
    .select()
    .from(shipment)
    .where(eq(shipment.id, shipmentId))
    .for('update')
  if (!before) throw new TrackingEditRefused('Shipment not found.', ctx.storeId)
  if (before.status === 'cancelled') {
    throw new TrackingEditRefused('This shipment was cancelled.', ctx.storeId)
  }
  const waybill = input.waybill.trim()
  if (!waybill) throw new TrackingEditRefused('Enter a tracking number.', ctx.storeId)
  const carrier = input.courier === undefined ? before.carrier : input.courier.trim() || null
  const trackingUrl =
    input.trackingUrl === undefined ? before.trackingUrl : input.trackingUrl.trim() || null
  if (
    waybill === before.waybill &&
    carrier === before.carrier &&
    trackingUrl === before.trackingUrl
  ) {
    return { shipment: before, changed: false }
  }
  if (waybill !== before.waybill) {
    const [taken] = await ctx.tx
      .select({ id: shipment.id })
      .from(shipment)
      .where(
        and(
          eq(shipment.provider, before.provider),
          eq(shipment.waybill, waybill),
          ne(shipment.id, before.id),
        ),
      )
      .limit(1)
    if (taken) {
      throw new TrackingEditRefused(
        'Another shipment already uses this tracking number.',
        ctx.storeId,
      )
    }
  }
  const [after] = await ctx.tx
    .update(shipment)
    .set({ waybill, carrier, trackingUrl, updatedAt: new Date() })
    .where(eq(shipment.id, before.id))
    .returning()
  if (!after) throw new TrackingEditRefused('Shipment not found.', ctx.storeId)
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: after.orderId,
    body: changeNote(before, after),
    author,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'shipment.tracking_updated', {
    orderId: after.orderId,
    shipmentId: after.id,
  })
  return { shipment: after, changed: true }
}
