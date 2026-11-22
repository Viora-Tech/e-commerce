/**
 * WHAT:  whether a shipment's courier schedules its own pickup when the label is booked
 *        (capability `pickup_at_booking`, RapidShyp today), and its name for the refusal line.
 * WHY:   that pickup can't be undone over the courier's API: "Move back to Booked" only changed
 *        our record while the courier still came, so it and Create pickup are never offered for
 *        such parcels; cancelling the shipment is the one way to stop it (owner, 23 Nov 2026).
 * WHERE: shipping.service (details, Move back to Booked), shipments-workspace.service (list rows),
 *        shipments-operations.service (Create pickup).
 */
import type { ShippingRegistry } from '@commerce/core'

/** The courier's name when it schedules its own pickup at booking, else null. */
export function pickupByCourier(
  registry: Pick<ShippingRegistry, 'get'> | undefined,
  providerId: string,
): string | null {
  const factory = registry?.get(providerId)
  return factory?.capabilities.includes('pickup_at_booking') ? factory.label : null
}
