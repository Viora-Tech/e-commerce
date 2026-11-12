/** SOURCE OF TRUTH: cancelBlock, shipmentLabelUrl, storedLabelUrl — WHAT: whether a booked
 * shipment can still be cancelled (and why not), and the label link the admin may open / WHY:
 * the server refuses a cancel for the same reasons the admin explains, and no courier API link
 * that needs the merchant's key ever reaches the browser.
 *
 * Pure, no database: the admin imports it from `@commerce/core/shipment-state`.
 */

/** Why a shipment can't be cancelled any more; null when it can. */
export type CancelBlock =
  /** The courier app has no cancel, or it was shipped by hand. */
  | 'not_supported'
  /** Already cancelled. */
  | 'cancelled'
  /** The courier has collected it: from here it is an RTO, not a cancel. */
  | 'picked_up'
  /** Delivered or on its way back. */
  | 'settled'
  /** Handed over in a manifest: the courier already counts it as collected. */
  | 'in_manifest'

const MOVING: ReadonlySet<string> = new Set(['picked_up', 'in_transit', 'out_for_delivery'])
const SETTLED: ReadonlySet<string> = new Set(['delivered', 'rto'])

/**
 * Cancel is allowed only while the label exists and the parcel has not left: status `created`,
 * not in a manifest, with a courier that cancels over its API. A pickup *requested* is fine;
 * the courier simply finds nothing to collect.
 */
export function cancelBlock(
  shipment: { status: string },
  facts: { inManifest: boolean; courierCancels: boolean },
): CancelBlock | null {
  if (shipment.status === 'cancelled') return 'cancelled'
  if (SETTLED.has(shipment.status)) return 'settled'
  if (MOVING.has(shipment.status)) return 'picked_up'
  if (facts.inManifest) return 'in_manifest'
  if (!facts.courierCancels) return 'not_supported'
  return null
}

/** Where the admin downloads a shipment's label. Relative: it is only ever opened from the admin. */
export const storedLabelUrl = (shipmentId: string) => `/api/shipments/${shipmentId}/label`

/**
 * Courier label links that only open with the merchant's API key in a header. Shipments booked
 * before the label route stored Delhivery's packing slip URL itself, which answers 401 in a
 * browser ("Authentication credentials were not provided"); those are served by the admin's
 * route instead, read-time, so no row needs rewriting.
 */
const KEYED_LABEL = /^https:\/\/[^/]*delhivery\.com\/api\/p\/packing_slip/i

/** True when this stored link needs the courier key, so the admin route serves it. */
export const isKeyedLabelUrl = (labelUrl: string | null | undefined): boolean =>
  typeof labelUrl === 'string' && KEYED_LABEL.test(labelUrl)

/** The label link the admin may open: the stored one, or the admin's route for a keyed link. */
export function shipmentLabelUrl(shipment: { id: string; labelUrl: string | null }): string | null {
  if (!shipment.labelUrl) return null
  return isKeyedLabelUrl(shipment.labelUrl) ? storedLabelUrl(shipment.id) : shipment.labelUrl
}
