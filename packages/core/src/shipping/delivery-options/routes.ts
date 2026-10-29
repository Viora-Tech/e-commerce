/** SOURCE OF TRUTH: delivery routes — WHAT: a route is one courier × channel × service (Delhivery
 * Express direct, Blue Dart Air via Shiprocket); this file turns what the connected apps
 * answered for a PIN code into routes, names the carrier the shopper sees, tells Surface from
 * Express, matches route selectors and applies the merchant's per-route settings / WHY: the
 * engine, Try a PIN and booking all need the same idea of "which route is this". Pure.
 */
import {
  type CostCard,
  carrierSettingKey,
  type DeliverySpeed,
  type RouteSelector,
  type RouteSetting,
} from './config'

/** Couriers that resell other couriers. Their services name the carrier behind them. */
export const AGGREGATOR_PROVIDERS: ReadonlySet<string> = new Set(['shiprocket', 'rapidshyp'])

/** Known carriers: key, shopper-facing name, and how an aggregator spells them. */
const CARRIERS: ReadonlyArray<{ key: string; name: string; match: RegExp }> = [
  { key: 'delhivery', name: 'Delhivery', match: /delhivery/i },
  { key: 'bluedart', name: 'Blue Dart', match: /blue\s*dart/i },
  { key: 'dtdc', name: 'DTDC', match: /dtdc/i },
  { key: 'xpressbees', name: 'Xpressbees', match: /xpress\s*bees/i },
  { key: 'ekart', name: 'Ekart', match: /ekart/i },
  { key: 'shadowfax', name: 'Shadowfax', match: /shadowfax/i },
  { key: 'ecom-express', name: 'Ecom Express', match: /ecom\s*express/i },
  { key: 'india-post', name: 'India Post', match: /india\s*post|speed\s*post/i },
  { key: 'amazon', name: 'Amazon Shipping', match: /amazon/i },
  { key: 'dhl', name: 'DHL', match: /\bdhl\b/i },
  { key: 'fedex', name: 'FedEx', match: /fedex/i },
  { key: 'gati', name: 'Gati', match: /\bgati\b/i },
  { key: 'smartr', name: 'Smartr', match: /smartr/i },
  { key: 'professional', name: 'The Professional Couriers', match: /professional/i },
]

/** A direct courier app's id → its carrier key, where they differ. */
const DIRECT_CARRIER: Record<string, string> = {
  indiapost: 'india-post',
  'india-post': 'india-post',
  'dhl-express': 'dhl',
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** "Bluedart Air", "Blue Dart Surface 2kg" → `{ key: 'bluedart', name: 'Blue Dart' }`; an
 *  unknown name keeps itself (its first word stripped of weights is too clever to guess). */
export function normaliseCarrier(raw: string): { key: string; name: string } {
  const known = CARRIERS.find((c) => c.match.test(raw))
  if (known) return { key: known.key, name: known.name }
  const name = raw.replace(/\s+\d+(\.\d+)?\s*kg\b.*$/i, '').trim() || raw
  return { key: slug(name) || 'courier', name }
}

/** The carrier a direct courier app delivers with. */
export function directCarrier(
  providerId: string,
  providerLabel: string,
): { key: string; name: string } {
  const key = DIRECT_CARRIER[providerId]
  const known = CARRIERS.find((c) => c.key === (key ?? providerId))
  return known ? { key: known.key, name: known.name } : normaliseCarrier(providerLabel)
}

const EXPRESS = /express|\bair\b|apex|priority|premium|next\s*day|same\s*day/i

/** Surface or Express, read from the service name with the carrier's own name taken out
 *  ("Ecom Express Surface" is Surface). Delhivery's direct modes are `S` and `E`. */
export function serviceSpeed(
  serviceId: string,
  serviceLabel: string,
  carrierName: string,
): DeliverySpeed {
  if (serviceId === 'E') return 'express'
  if (serviceId === 'S') return 'standard'
  const label = serviceLabel.replace(new RegExp(carrierName.replace(/\s+/g, '\\s*'), 'ig'), ' ')
  if (/surface|ground|economy/i.test(label)) return 'standard'
  return EXPRESS.test(label) ? 'express' : 'standard'
}

/** One service as an app answered it for this PIN code, before any merchant setting. */
export type QuotedService = {
  serviceId: string
  serviceLabel: string
  /** The carrier behind an aggregator's service; null for a direct courier. */
  carrier: string | null
  /** Tax-inclusive total for prepaid; null when the app has no live price. */
  pricePaise: number | null
  /** Total for cash on delivery, when asked and answered. */
  codPricePaise: number | null
  /** The insurance line the quote itemised, when it did. */
  insurancePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
  codAvailable: boolean | null
}

/**
 * What one connected app said for one PIN code. `failed`: its calls threw or missed the
 * checkout deadline, which is never the same as "not serviceable".
 */
export type ProviderAnswer = {
  providerId: string
  providerLabel: string
  status: 'ok' | 'failed'
  source: 'live' | 'cache'
  /** How long the live call took; null from cache or when it timed out. */
  ms: number | null
  error: string | null
  /** The PIN code answer; null when serviceability did not answer. */
  serviceable: boolean | null
  services: QuotedService[]
}

export type Route = {
  /** `providerId:serviceId`: what booking passes back. */
  key: string
  providerId: string
  providerLabel: string
  channel: 'direct' | 'aggregator'
  carrierKey: string
  /** What the shopper reads: "Blue Dart". Never the aggregator. */
  carrier: string
  serviceId: string
  serviceLabel: string
  speed: DeliverySpeed
  /** Quote total less any itemised insurance, prepaid; from the cost card when no live price. */
  costPaise: number | null
  codCostPaise: number | null
  /** True when the cost comes from the merchant's cost card. */
  costFromCard: boolean
  quotedInsurancePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
  codAvailable: boolean | null
  serviceable: boolean
  insures: boolean
  insurancePercent: number | null
  insuranceMinPaise: number | null
  enabled: boolean
  source: 'live' | 'cache'
  ms: number | null
}

export const routeKey = (providerId: string, serviceId: string): string =>
  `${providerId}:${serviceId}`

/** Does the selector mean this route? */
export function selectorMatches(
  route: Pick<Route, 'carrierKey' | 'channel' | 'providerId' | 'speed' | 'serviceId'>,
  sel: RouteSelector,
): boolean {
  if (sel.carrier !== 'any' && sel.carrier !== route.carrierKey) return false
  const ch = sel.channel ?? 'any'
  if (ch === 'direct' && route.channel !== 'direct') return false
  if (ch === 'aggregator' && route.channel !== 'aggregator') return false
  if (ch !== 'any' && ch !== 'direct' && ch !== 'aggregator' && ch !== route.providerId)
    return false
  if (sel.speed && sel.speed !== 'any' && sel.speed !== route.speed) return false
  if (sel.serviceId && sel.serviceId !== route.serviceId) return false
  return true
}

/** The owner's facts (29 Oct): Delhivery direct insures; Blue Dart and DTDC direct do not;
 *  aggregator routes insure through the aggregator. Unknown direct couriers: not insured. */
function seededInsures(channel: Route['channel'], carrierKey: string): boolean {
  if (channel === 'aggregator') return true
  return carrierKey === 'delhivery'
}

/** The settings that apply to a route, most specific first. */
function settingsFor(
  settings: readonly RouteSetting[],
  key: string,
  carrierKey: string,
  channel: Route['channel'],
  providerId: string,
): RouteSetting[] {
  const keys = [
    key,
    carrierSettingKey(carrierKey, providerId),
    carrierSettingKey(carrierKey, channel),
    carrierSettingKey(carrierKey, 'any'),
  ]
  return keys.flatMap((k) => settings.filter((s) => s.key === k))
}

const firstSet = <T>(
  list: RouteSetting[],
  pick: (s: RouteSetting) => T | null | undefined,
): T | null => {
  for (const s of list) {
    const v = pick(s)
    if (v !== null && v !== undefined) return v
  }
  return null
}

/** Weight the courier bills: whole 500 g steps. */
export const halfKgSteps = (weightGrams: number): number =>
  Math.max(1, Math.ceil(weightGrams / 500))

/** A cost card's price for a parcel: first 500 g, then each further 500 g; COD adds its fee. */
function costCardPrice(card: CostCard, weightGrams: number, cod: boolean): number {
  const price = card.firstHalfKgPaise + (halfKgSteps(weightGrams) - 1) * card.extraHalfKgPaise
  return cod ? price + card.codFeePaise : price
}

/**
 * Every route the apps answered, with the merchant's settings applied. A not-serviceable or
 * failed app gives routes marked so (the engine records why they were dropped).
 */
export function routesFromAnswers(
  answers: readonly ProviderAnswer[],
  settings: readonly RouteSetting[],
  weightGrams: number,
): Route[] {
  return answers.flatMap((a) =>
    a.status !== 'ok'
      ? []
      : a.services.map((s): Route => {
          const channel: Route['channel'] =
            s.carrier !== null || AGGREGATOR_PROVIDERS.has(a.providerId) ? 'aggregator' : 'direct'
          const carrier =
            channel === 'aggregator'
              ? normaliseCarrier(s.carrier ?? s.serviceLabel)
              : directCarrier(a.providerId, a.providerLabel)
          const key = routeKey(a.providerId, s.serviceId)
          const own = settingsFor(settings, key, carrier.key, channel, a.providerId)
          const card = firstSet(own, (x) => x.costCard)
          const live = s.pricePaise !== null
          const insurance = s.insurancePaise ?? null
          const less = (p: number | null) => (p === null ? null : Math.max(0, p - (insurance ?? 0)))
          return {
            key,
            providerId: a.providerId,
            providerLabel: a.providerLabel,
            channel,
            carrierKey: carrier.key,
            carrier: carrier.name,
            serviceId: s.serviceId,
            serviceLabel: s.serviceLabel,
            speed: serviceSpeed(s.serviceId, s.serviceLabel, carrier.name),
            costPaise: live
              ? less(s.pricePaise)
              : card
                ? costCardPrice(card, weightGrams, false)
                : null,
            codCostPaise: live
              ? less(s.codPricePaise)
              : card
                ? costCardPrice(card, weightGrams, true)
                : null,
            costFromCard: !live && card !== null,
            quotedInsurancePaise: insurance,
            minTransitDays: s.minTransitDays,
            maxTransitDays: s.maxTransitDays,
            codAvailable: s.codAvailable,
            serviceable: a.serviceable !== false,
            insures: firstSet(own, (x) => x.insures) ?? seededInsures(channel, carrier.key),
            insurancePercent: firstSet(own, (x) => x.insurancePercent),
            insuranceMinPaise: firstSet(own, (x) => x.insuranceMinPaise),
            enabled: own.every((x) => x.enabled),
            source: a.source,
            ms: a.ms,
          }
        }),
  )
}

/**
 * What insurance costs on this route for this order value: the quote's own line when it
 * itemised one, else the merchant's rate (% with a minimum). Null when neither is known:
 * the admin warns that insurance cannot be priced until the rate is filled in.
 */
export function insurancePrice(route: Route, orderValuePaise: number): number | null {
  if (route.quotedInsurancePaise !== null) return route.quotedInsurancePaise
  if (route.insurancePercent === null && route.insuranceMinPaise === null) return null
  const byPercent = Math.ceil((orderValuePaise * (route.insurancePercent ?? 0)) / 100)
  return Math.max(byPercent, route.insuranceMinPaise ?? 0)
}

/** The carrier a booking delivers with: a direct courier's own, or the one behind an
 *  aggregator's service ("Bluedart Air" → Blue Dart); null when an aggregator named none. */
export function bookedCarrier(
  provider: { id: string; label: string },
  serviceLabel: string | null | undefined,
): string | null {
  if (!AGGREGATOR_PROVIDERS.has(provider.id)) return directCarrier(provider.id, provider.label).name
  return serviceLabel ? normaliseCarrier(serviceLabel).name : null
}
