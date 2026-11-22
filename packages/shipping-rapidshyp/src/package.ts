/** The parcel's size and weight as RapidShyp's order APIs take them (`packageDetails`). */

import { CourierError, type CreateShipmentInput } from '@commerce/shipping'

/** RapidShyp's stand-in box when a parcel has no size: the 10 cm cube sent before 22 Nov 2026. */
const NO_BOX_CM = 10

/**
 * The parcel as the merchant saw it in Create shipment: its box (`dimensionsCm`) and its weight
 * in grams, which is the unit RapidShyp's order APIs take (`packageWeight`; serviceability alone
 * takes kilograms). Until 22 Nov 2026 every order went as a 10 cm cube, whatever its box
 * (order #2082: a 20 x 20 x 5 cm box showed as 10 x 10 x 10 on RapidShyp's panel).
 */
export function packageDetails(input: Pick<CreateShipmentInput, 'weightGrams' | 'dimensionsCm'>) {
  const side = (cm: number | undefined) => (cm && cm > 0 ? Math.round(cm * 100) / 100 : NO_BOX_CM)
  const box = input.dimensionsCm
  return {
    packageLength: side(box?.length),
    packageBreadth: side(box?.width),
    packageHeight: side(box?.height),
    packageWeight: Math.max(Math.round(input.weightGrams), 1),
  }
}

const ORDER_UPDATE = '/rapidshyp/apis/v1/order_update'

type OrderUpdateResponse = { status?: string; remarks?: string; not_updated_fields?: string }

/**
 * Update Order (`order_update`, docs: Forward B2C > Orders > Update Order API) with the parcel
 * as it ships: an order sent to RapidShyp earlier as a pending order (order push) keeps the
 * package it was pushed with (no box, so the 10 cm cube, and the order's weight then) unless it
 * is updated. Order #2088 (22 Nov 2026) was booked on its pushed order and billed as
 * 0.5 kg, 10 x 10 x 10 cm while the merchant had typed 1 kg, 37 x 14 x 4 cm.
 * Refused, nothing is booked: the order would bill the package it was first sent with.
 */
export async function updatePushedPackage(
  post: <T>(path: string, body: unknown) => Promise<T>,
  provider: string,
  storeName: string,
  orderRef: string,
  input: Pick<CreateShipmentInput, 'weightGrams' | 'dimensionsCm'>,
): Promise<void> {
  const refused = await packageRefusal(post, storeName, orderRef, input)
  if (!refused) return
  throw new CourierError(
    'rejected',
    provider,
    `RapidShyp would not take this parcel's weight and size for order ${orderRef}, so it was not booked (it would bill the size it was first sent with). Open order ${orderRef} in RapidShyp, set the package there, then book again. (${refused})`,
    { reason: refused },
  )
}

/** RapidShyp's remark when Update Order did not take the package, else null. */
async function packageRefusal(
  post: <T>(path: string, body: unknown) => Promise<T>,
  storeName: string,
  orderRef: string,
  input: Pick<CreateShipmentInput, 'weightGrams' | 'dimensionsCm'>,
): Promise<string | null> {
  try {
    const r = await post<OrderUpdateResponse>(ORDER_UPDATE, {
      orderId: orderRef,
      store_name: storeName,
      packageDetails: packageDetails(input),
    })
    const ok = String(r?.status ?? '').toLowerCase() === 'success'
    const skipped = (r?.not_updated_fields ?? '').toLowerCase().includes('package')
    return ok && !skipped ? null : r?.remarks?.trim() || r?.not_updated_fields || 'no detail'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
