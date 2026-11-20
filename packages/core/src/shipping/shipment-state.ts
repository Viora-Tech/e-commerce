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

const MOVING: ReadonlySet<string> = new Set(['picked_up', 'in_transit', 'out_for_delivery'])
const SETTLED: ReadonlySet<string> = new Set(['delivered', 'rto'])

/**
 * Cancel is allowed only while the label exists and the parcel has not left: status `created`,
 * with a courier that cancels over its API. A pickup *requested* is fine, and so is a manifest:
 * ours is a printed list for the pickup executive, never sent to the courier, and the courier
 * takes a cancel until it scans the parcel (owner, 18 Nov 2026: cancel from To be picked up).
 */
export function cancelBlock(
  shipment: { status: string },
  facts: { courierCancels: boolean },
): CancelBlock | null {
  if (shipment.status === 'cancelled') return 'cancelled'
  if (SETTLED.has(shipment.status)) return 'settled'
  if (MOVING.has(shipment.status)) return 'picked_up'
  if (!facts.courierCancels) return 'not_supported'
  return null
}

/**
 * True when the parcel is still at the store although its pickup day (YYYY-MM-DD, India time)
 * is before `today`: the courier did not collect it, so it may be booked on a new pickup.
 */
export const pickupMissed = (
  shipment: { status: string },
  pickup: { date: string } | null,
  today: string,
): boolean => shipment.status === 'created' && pickup !== null && pickup.date < today

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
