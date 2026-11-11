/** SOURCE OF TRUTH: a delivery option order's shipping margin — WHAT: what the shopper was charged
 * for shipping against what the courier costs plus insurance, the courier cost being the
 * booking's own charge once there is one, else what the route quoted at checkout. A cart split
 * across locations adds up every parcel's courier and insurance (owner, 12 Nov 2026) / WHY: the
 * order page shows whether Express and Standard pay for themselves, order by order. Pure, safe
 * for the browser (`@commerce/core/delivery-margin`).
 */
import type { OrderDeliveryRoute } from '@commerce/db'

export type ShippingMargin = {
  chargedPaise: number
  /** Null when neither a booking charge nor a checkout quote is known (orders on backup). */
  courierPaise: number | null
  /** `mixed`: a split cart with some parcels booked and others still on their checkout quote. */
  courierFrom: 'booking' | 'quote' | 'mixed' | null
  insurancePaise: number
  /** Charged less courier and insurance; null while the courier cost is unknown. */
  marginPaise: number | null
}

type MarginRoute = Pick<OrderDeliveryRoute, 'courierCostPaise' | 'insured' | 'insurancePaise'>

/** One route's courier cost: its booking's charge, else its checkout quote, else unknown. */
function courierOf(route: MarginRoute, booked: number | null | undefined) {
  if (booked != null) return { paise: booked, from: 'booking' as const }
  if (route.courierCostPaise != null)
    return { paise: route.courierCostPaise, from: 'quote' as const }
  return { paise: null, from: null }
}

const insuranceOf = (route: MarginRoute) => (route.insured ? (route.insurancePaise ?? 0) : 0)

/**
 * The order's shipping margin. `bookingChargePaise` is the order's latest booking charge (an
 * order in one parcel). A split cart (`delivery.parcels`) adds up every parcel: its own
 * booking's charge from `parcelCharges` (fulfilment order id -> paise), else its checkout
 * quote, plus its insurance; the margin stays unknown until every parcel's cost is known.
 */
export function shippingMargin(
  delivery: MarginRoute & Pick<OrderDeliveryRoute, 'parcels'>,
  chargedPaise: number,
  bookingChargePaise: number | null | undefined,
  parcelCharges: Readonly<Record<string, number>> = {},
): ShippingMargin {
  const routes = delivery.parcels?.length ? delivery.parcels : null
  const parts = routes
    ? routes.map((p) => ({
        ...courierOf(p, p.fulfillmentOrderId ? parcelCharges[p.fulfillmentOrderId] : null),
        insurance: insuranceOf(p),
      }))
    : [{ ...courierOf(delivery, bookingChargePaise), insurance: insuranceOf(delivery) }]
  const known = parts.every((p) => p.paise !== null)
  const sources = new Set(parts.map((p) => p.from))
  const courierPaise = known ? parts.reduce((sum, p) => sum + (p.paise ?? 0), 0) : null
  const courierFrom = !known ? null : sources.size > 1 ? 'mixed' : (parts[0]?.from ?? null)
  const insurancePaise = parts.reduce((sum, p) => sum + p.insurance, 0)
  return {
    chargedPaise,
    courierPaise,
    courierFrom,
    insurancePaise,
    marginPaise: courierPaise === null ? null : chargedPaise - courierPaise - insurancePaise,
  }
}
