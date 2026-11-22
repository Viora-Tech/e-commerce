/** The parcel's size and weight as RapidShyp's order APIs take them (`packageDetails`). */

import type { CreateShipmentInput } from '@commerce/shipping'

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
