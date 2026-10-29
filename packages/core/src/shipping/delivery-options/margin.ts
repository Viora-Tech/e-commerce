/** SOURCE OF TRUTH: a delivery option order's shipping margin — WHAT: what the shopper was charged
 * for shipping against what the courier costs plus insurance, the courier cost being the
 * booking's own charge once there is one, else what the route quoted at checkout / WHY: the
 * order page shows whether Express and Standard pay for themselves, order by order. Pure, safe
 * for the browser (`@commerce/core/delivery-margin`).
 */
import type { OrderDeliveryRoute } from '@commerce/db'

export type ShippingMargin = {
  chargedPaise: number
  /** Null when neither a booking charge nor a checkout quote is known (orders on backup). */
  courierPaise: number | null
  courierFrom: 'booking' | 'quote' | null
  insurancePaise: number
  /** Charged less courier and insurance; null while the courier cost is unknown. */
  marginPaise: number | null
}

export function shippingMargin(
  delivery: Pick<OrderDeliveryRoute, 'courierCostPaise' | 'insured' | 'insurancePaise'>,
  chargedPaise: number,
  bookingChargePaise: number | null | undefined,
): ShippingMargin {
  const courierFrom =
    bookingChargePaise != null ? 'booking' : delivery.courierCostPaise != null ? 'quote' : null
  const courierPaise =
    courierFrom === 'booking'
      ? (bookingChargePaise as number)
      : courierFrom === 'quote'
        ? delivery.courierCostPaise
        : null
  const insurancePaise = delivery.insured ? (delivery.insurancePaise ?? 0) : 0
  return {
    chargedPaise,
    courierPaise,
    courierFrom,
    insurancePaise,
    marginPaise: courierPaise === null ? null : chargedPaise - courierPaise - insurancePaise,
  }
}
