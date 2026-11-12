import type { OrderShippingSnapshot } from '@commerce/db'

/**
 * Create shipment's per-order inputs, kept pure: the shopper's checkout delivery choice read
 * from `order.shipping`, and the bulk drawer's Edit popup values merged over the batch's.
 */

/**
 * What the shopper picked at checkout: the delivery option (Delivery options app) or the zone
 * rate, what they paid for it, and the courier route it was priced on when one was saved.
 */
export type DeliveryChoice = {
  /** "Express", "Standard", or the zone rate's name. */
  name: string
  pricePaise: number
  /** "Delhivery Express"; null when no route was saved (zone rates, backup). */
  route: string | null
  providerId: string | null
  insured: boolean
}

/** The order's saved shipping (`order.shipping`) as the shopper's delivery choice. */
export function deliveryChoiceOf(
  shipping: OrderShippingSnapshot | null | undefined,
): DeliveryChoice | null {
  if (!shipping) return null
  const d = shipping.delivery
  const route = d?.route ?? null
  return {
    name: d?.optionName || shipping.rateName,
    pricePaise: shipping.pricePaise,
    route: route ? [route.carrier, route.serviceLabel].filter(Boolean).join(' ') : null,
    providerId: route?.providerId ?? null,
    insured: d?.insured ?? false,
  }
}

/** What the bulk drawer's Edit popup changed for one order (`shipments.bulkBook`'s `perOrder`). */
export type OrderBookingOverride = {
  weightGrams?: number | undefined
  dimensionsCm?: { length: number; width: number; height: number } | undefined
  paymentMode?: 'cod' | 'prepaid' | undefined
  insured?: boolean | undefined
}

/** One order's booking values: its own from the Edit popup, else the batch's. */
export function bookingFor(
  batch: Pick<OrderBookingOverride, 'weightGrams' | 'dimensionsCm' | 'insured'>,
  own: OrderBookingOverride | undefined,
): OrderBookingOverride {
  const out: OrderBookingOverride = {
    weightGrams: own?.weightGrams ?? batch.weightGrams,
    dimensionsCm: own?.dimensionsCm ?? batch.dimensionsCm,
    insured: own?.insured ?? batch.insured,
  }
  if (own?.paymentMode) out.paymentMode = own.paymentMode
  return out
}
