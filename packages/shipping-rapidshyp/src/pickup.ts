/**
 * Create pickup for RapidShyp parcels whose pickup was refused at booking. RapidShyp books a
 * pickup per shipment (Schedule Pickup API: `shipment_id` mandatory, `awb` optional), so each
 * parcel's shipment id is read from Track Order by its AWB, then that shipment's pickup is asked.
 * Until 23 Nov 2026 a refused pickup at booking left the parcel in Booked for good: Create pickup
 * was hidden for every RapidShyp parcel.
 */

import {
  CourierError,
  type SchedulePickupInput,
  type SchedulePickupResult,
} from '@commerce/shipping'

type PickupCalls = {
  provider: string
  /** RapidShyp's shipment id for this AWB, from Track Order. */
  shipmentIdOf: (awb: string) => Promise<string | undefined>
  schedulePickup: (
    shipmentId: string,
    awb: string,
  ) => Promise<{ status?: string; remarks?: string }>
}

/** Ask the pickup of each parcel (by AWB); refused, nothing is recorded as on a pickup. */
export async function scheduleRapidshypPickups(
  calls: PickupCalls,
  input: Pick<SchedulePickupInput, 'parcels'>,
): Promise<SchedulePickupResult> {
  const waybills = (input.parcels ?? []).map((p) => p.waybill)
  if (waybills.length === 0) {
    throw new CourierError('rejected', calls.provider, 'Pick the parcels to be picked up.')
  }
  const done: string[] = []
  for (const awb of waybills) {
    const shipmentId = await calls.shipmentIdOf(awb)
    if (!shipmentId) {
      throw new CourierError(
        'rejected',
        calls.provider,
        `RapidShyp could not find the parcel with AWB ${awb}, so its pickup was not asked.${asked(done)}`,
      )
    }
    const r = await calls.schedulePickup(shipmentId, awb)
    if (String(r?.status ?? '').toUpperCase() !== 'SUCCESS') {
      const remark = r?.remarks?.trim()
      throw new CourierError(
        'rejected',
        calls.provider,
        `RapidShyp did not take the pickup for AWB ${awb}${remark ? `: ${remark}` : ''}.${asked(done)}`,
        { reason: remark || undefined },
      )
    }
    done.push(awb)
  }
  return { providerPickupId: done.join(', ') }
}

/** The parcels already on a pickup when a later one was refused, so the merchant knows. */
const asked = (done: string[]) =>
  done.length ? ` RapidShyp did take the pickup for ${done.join(', ')}.` : ''
