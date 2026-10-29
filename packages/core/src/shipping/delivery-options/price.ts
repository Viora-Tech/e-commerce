/** SOURCE OF TRUTH: delivery option prices and dates — WHAT: a route's price for an option (cost + markup + insurance, rounded up to the next ₹10, caps, free above) and its arrival window from the route's transit days and the store's calendar / WHY: the engine, the backup option and the trace must price and date a route the same way. Pure. */
import { computeDeliveryEstimate } from '@commerce/shipping'
import type { ShippingRateOption } from '../rates'
import type { DeliveryOption } from './config'
import type { PricedRoute, ResolveInput, RouteSummary, ZoneQuote } from './resolve-types'
import { insurancePrice, type Route } from './routes'

/** ₹10 in paise. */
const TEN_RUPEES = 1000

/** Round up to the next ₹10: ₹141 → ₹150, ₹150 stays. */
export const roundUpToTenRupees = (paise: number): number =>
  Math.ceil(Math.max(0, paise) / TEN_RUPEES) * TEN_RUPEES

export const summary = (r: Route): RouteSummary => ({
  key: r.key,
  providerId: r.providerId,
  providerLabel: r.providerLabel,
  channel: r.channel,
  carrierKey: r.carrierKey,
  carrier: r.carrier,
  serviceId: r.serviceId,
  serviceLabel: r.serviceLabel,
  speed: r.speed,
  source: r.source,
})

export type Dated = {
  earliest: string | null
  latest: string | null
  estimated: boolean
  transitMax: number
}

export function datesFor(route: Route | null, option: DeliveryOption, input: ResolveInput): Dated {
  const { policy, now } = input
  const eta = option.eta
  const fixed = eta.source === 'fixed' && eta.fixedMinDays != null && eta.fixedMaxDays != null
  const known = route !== null && route.minTransitDays !== null && route.maxTransitDays !== null
  const min = fixed
    ? (eta.fixedMinDays as number)
    : known
      ? (route?.minTransitDays as number)
      : policy.defaultMinTransitDays
  const max = fixed
    ? (eta.fixedMaxDays as number)
    : known
      ? (route?.maxTransitDays as number)
      : policy.defaultMaxTransitDays
  try {
    const e = computeDeliveryEstimate({
      now,
      minTransitDays: min + eta.processingDays,
      maxTransitDays: max + eta.processingDays + eta.bufferDays,
      policy,
    })
    return {
      earliest: e.earliestDate,
      latest: e.latestDate,
      estimated: !fixed && !known,
      transitMax: max,
    }
  } catch {
    // A calendar with no working days cannot produce a date; the card shows none.
    return { earliest: null, latest: null, estimated: !fixed && !known, transitMax: max }
  }
}

/** Route cost + markup + insurance, rounded up to ₹10, then caps and free-above. */
export function priceRoute(
  route: Route,
  option: DeliveryOption,
  input: ResolveInput,
  insured: boolean,
  cod: boolean,
): PricedRoute | null {
  const base = cod ? (route.codCostPaise ?? route.costPaise) : route.costPaise
  if (base === null) return null
  const insurance = insured ? insurancePrice(route, input.cart.valuePaise) : 0
  const p = option.price
  const zoneRate = p.source === 'zone' ? cheapestZoneRate(input.zone) : null
  const markup = p.markupPaise + Math.ceil((base * p.markupPercent) / 100)
  const raw = zoneRate
    ? zoneRate.listPricePaise + (insurance ?? 0)
    : base + markup + (insurance ?? 0)
  let list = roundUpToTenRupees(raw)
  if (p.minPaise != null) list = Math.max(list, p.minPaise)
  if (p.maxPaise != null) list = Math.min(list, p.maxPaise)
  const zoneFree = zoneRate !== null && zoneRate.pricePaise === 0
  const free = zoneFree || (p.freeAbovePaise != null && input.cart.valuePaise >= p.freeAbovePaise)
  const dated = datesFor(route, option, input)
  return {
    route: summary(route),
    pricePaise: free ? 0 : list,
    listPricePaise: list,
    courierCostPaise: base,
    markupPaise: zoneRate ? 0 : markup,
    insurancePaise: insured ? insurance : 0,
    insured,
    earliest: dated.earliest,
    latest: dated.latest,
    etaEstimated: dated.estimated,
  }
}

export function cheapestZoneRate(zone: ZoneQuote): ShippingRateOption | null {
  if (zone.kind !== 'rates' || zone.options.length === 0) return null
  return zone.options.reduce((a, b) => (b.pricePaise < a.pricePaise ? b : a))
}
