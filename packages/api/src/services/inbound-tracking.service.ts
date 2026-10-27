/** SOURCE OF TRUTH: refreshInboundTracking — WHAT: reads an inbound shipment's expected delivery date from its carrier's tracking (FedEx, DHL Express, Blue Dart, Delhivery when connected as a shipping app) / WHY: the merchant pastes a tracking number and the arrival date fills itself */
import { parseShippingSettings, shippingProviderById } from '@commerce/core'
import { inboundTrackingCourier } from '@commerce/core/inventory'
import { inboundShipment, type StoreTx, store } from '@commerce/db'
import type { ShippingRegistry } from '@commerce/shipping'
import { eq } from 'drizzle-orm'

export type InboundTrackingResult =
  /** The carrier gave a date (or none yet); `expectedAt` is what the shipment now has. */
  | { ok: true; expectedAt: string | null; delivered: boolean }
  /** Nothing to read: no number, a carrier we cannot track, or its app is not connected. */
  | {
      ok: false
      reason: 'no_number' | 'unsupported' | 'not_connected' | 'failed'
      carrier: string | null
    }

/**
 * Ask the carrier for the shipment's expected delivery date and store it with the time it was
 * read. A carrier that gives no date leaves the typed one alone. Errors from the carrier are
 * returned as `failed`, never thrown: tracking is a convenience on top of the saved shipment.
 */
export async function refreshInboundTracking(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  id: string,
): Promise<InboundTrackingResult> {
  const [row] = await tx
    .select({
      carrier: inboundShipment.carrier,
      trackingNumber: inboundShipment.trackingNumber,
      expectedAt: inboundShipment.expectedAt,
    })
    .from(inboundShipment)
    .where(eq(inboundShipment.id, id))
  if (!row?.trackingNumber) return { ok: false, reason: 'no_number', carrier: row?.carrier ?? null }
  const courier = inboundTrackingCourier(row.carrier)
  if (!courier) return { ok: false, reason: 'unsupported', carrier: row.carrier }
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  const provider = shippingProviderById(
    registry,
    parseShippingSettings(s?.shipping),
    secret,
    courier,
  )
  if (!provider) return { ok: false, reason: 'not_connected', carrier: row.carrier }
  try {
    const tracking = await provider.track(row.trackingNumber)
    const expectedAt = tracking.expectedDate ?? row.expectedAt
    await tx
      .update(inboundShipment)
      .set({ expectedAt, trackedAt: new Date(), updatedAt: new Date() })
      .where(eq(inboundShipment.id, id))
    return { ok: true, expectedAt, delivered: tracking.status === 'delivered' }
  } catch {
    return { ok: false, reason: 'failed', carrier: row.carrier }
  }
}
