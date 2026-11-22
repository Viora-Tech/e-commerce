/**
 * WHAT:  which pickup actions the admin offers for a parcel whose courier schedules its own
 *        pickup at booking (RapidShyp: the row's `pickupByCourier` carries the courier's name).
 * WHY:   that pickup can't be undone over the courier's API, so "Move back to Booked" only changed
 *        our record while the courier still came; only Cancel shipment stops it, and Create pickup
 *        never asks again (owner, 23 Nov 2026). The server refuses both as well.
 * WHERE: shipment-cancel-dialog (Cancel… popup), shipments-bulk-actions (selection bar).
 */

export type CancelChoice = 'back' | 'shipment' | 'sendBack' | 'marked'

/**
 * The Cancel popup's choices that fit where the parcel is (owner, 18 Nov 2026): at the store,
 * "Cancel pickup" only while it is on a pickup and its courier did not schedule that pickup itself.
 */
export function cancelChoices(
  status: string,
  onPickup: boolean,
  pickupByCourier: string | null | undefined,
): CancelChoice[] {
  if (status !== 'created') return ['sendBack', 'marked']
  return onPickup && !pickupByCourier ? ['back', 'shipment', 'marked'] : ['shipment', 'marked']
}

/**
 * The ticked parcels a pickup action may take (`movable`), and the courier's name when any were
 * left out because their courier schedules its own pickup (`courier`, null when none were).
 */
export function splitCourierPickups(
  ids: string[],
  courierPickups: Readonly<Record<string, string>>,
): { movable: string[]; courier: string | null } {
  const movable = ids.filter((id) => !courierPickups[id])
  const left = ids.find((id) => courierPickups[id])
  return { movable, courier: left ? (courierPickups[left] ?? null) : null }
}
