/**
 * Shiprocket's pickup request: `POST /courier/generate/pickup` with `{ shipment_id: [...] }`,
 * answered `{ pickup_status: 1, response: { pickup_scheduled_date, pickup_token_number } }` when
 * taken (the shape the published SDKs read: ShipKore libshipkore, mritunjay10/shiprocket-api).
 * Asked right after the AWB at booking, so the parcel goes to To be picked up (owner, 23 Nov 2026);
 * when Shiprocket refuses there, the parcel stays in Booked and Create pickup asks again here.
 */

import {
  CourierError,
  type SchedulePickupInput,
  type SchedulePickupResult,
} from '@commerce/shipping'

export const GENERATE_PICKUP = '/courier/generate/pickup'

export type GeneratePickupResponse = {
  pickup_status?: number | string
  message?: string
  response?: { pickup_scheduled_date?: string; pickup_token_number?: string; data?: string }
}

type Post = <T>(path: string, body: unknown) => Promise<T>

/** Shiprocket took the pickup request. */
export const pickupTaken = (r: GeneratePickupResponse | undefined) => Number(r?.pickup_status) === 1

/** At booking: true when Shiprocket took the pickup; any refusal or error leaves it to Create pickup. */
export async function pickupAtBooking(
  post: Post,
  shipmentId: number | string | undefined,
): Promise<boolean> {
  if (shipmentId === undefined) return false
  const r = await post<GeneratePickupResponse>(GENERATE_PICKUP, {
    shipment_id: [Number(shipmentId)],
  }).catch(() => undefined)
  return pickupTaken(r)
}

/**
 * Create pickup for booked parcels: their Shiprocket shipment ids are the `providerRef` booking
 * saved. Refused, it throws in the merchant's words and core records the pickup as failed, so the
 * parcels stay in Booked.
 */
export async function scheduleShiprocketPickup(
  post: Post,
  provider: string,
  input: Pick<SchedulePickupInput, 'parcels'>,
): Promise<SchedulePickupResult> {
  const parcels = input.parcels ?? []
  const missing = parcels.filter((p) => !Number.isFinite(Number(p.providerRef)) || !p.providerRef)
  if (parcels.length === 0 || missing.length > 0) {
    throw new CourierError(
      'rejected',
      provider,
      missing.length > 0
        ? `Shiprocket's shipment number is missing for AWB ${missing.map((p) => p.waybill).join(', ')}. Ask for the pickup on Shiprocket's panel.`
        : 'Pick the parcels to be picked up.',
    )
  }
  const r = await post<GeneratePickupResponse>(GENERATE_PICKUP, {
    shipment_id: parcels.map((p) => Number(p.providerRef)),
  })
  if (!pickupTaken(r)) {
    const said = (r?.message || r?.response?.data || '').trim()
    throw new CourierError(
      'rejected',
      provider,
      `Shiprocket did not take the pickup${said ? `: ${said}` : '.'}`,
      { reason: said || undefined },
    )
  }
  return {
    providerPickupId:
      r.response?.pickup_token_number?.toString().trim() ||
      parcels.map((p) => p.waybill).join(', '),
  }
}
