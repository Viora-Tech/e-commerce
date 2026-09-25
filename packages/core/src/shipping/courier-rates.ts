import type { RateQuery, ShippingProvider } from '@commerce/shipping'

/**
 * Multi-courier rate comparison and booking-rule selection for the Shipments
 * workspace (Orders → Shipments). Pure functions over whatever couriers the
 * store connected - no database, no clock - so the workspace UI, the bulk
 * booking service and the tests all run the same code.
 *
 * One row per connected `ShippingProvider` (Delhivery, Shiprocket, ...), not
 * per sub-courier inside an aggregator: Shiprocket books through whichever of
 * its own network it recommends (see packages/shipping-shiprocket, AWB
 * assignment), so "Shiprocket" is one bookable choice here even though it
 * quotes across many carriers internally. A courier without a live price
 * quote (Delhivery: no confirmed rate API, see packages/shipping-delhivery)
 * still gets a row - transit time from serviceability, price left null and
 * shown as "priced by your shipping rates" rather than guessed at.
 */

export type CourierRateRow = {
  providerId: string
  providerLabel: string
  /** Null when this courier has no live price quote for this route. */
  pricePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
  /** Null when neither a rate quote nor serviceability answered. */
  codAvailable: boolean | null
  badges: Array<'cheapest' | 'fastest' | 'recommended'>
}

/**
 * Ask every connected courier for its price and transit time on one route.
 * One courier's failure (timeout, auth, a route it doesn't serve) never
 * blanks the rest of the table - it just gets a row with nulls.
 */
export async function compareCourierRates(
  providers: ShippingProvider[],
  query: RateQuery,
): Promise<CourierRateRow[]> {
  const rows = await Promise.all(providers.map((provider) => quoteOneCourier(provider, query)))
  return assignBadges(rows)
}

async function quoteOneCourier(
  provider: ShippingProvider,
  query: RateQuery,
): Promise<CourierRateRow> {
  const base: CourierRateRow = {
    providerId: provider.id,
    providerLabel: provider.label,
    pricePaise: null,
    minTransitDays: null,
    maxTransitDays: null,
    codAvailable: null,
    badges: [],
  }

  if (provider.quoteRate) {
    try {
      const quote = await provider.quoteRate(query)
      if (quote) {
        return {
          ...base,
          pricePaise: quote.pricePaise,
          minTransitDays: quote.minTransitDays,
          maxTransitDays: quote.maxTransitDays,
          /* A price-quoting courier that answered has served this route; COD support is asked
             for separately below since RateQuote does not carry it. */
          codAvailable: null,
        }
      }
    } catch {
      // Falls through to the serviceability-only row below.
    }
  }

  try {
    const s = await provider.checkServiceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
    })
    if (!s.serviceable) return base
    return {
      ...base,
      minTransitDays: s.minTransitDays,
      maxTransitDays: s.maxTransitDays,
      codAvailable: s.codAvailable,
    }
  } catch {
    return base
  }
}

function assignBadges(rows: CourierRateRow[]): CourierRateRow[] {
  const priced = rows.filter((r) => r.pricePaise !== null)
  const cheapest = priced.length
    ? priced.reduce((a, b) => ((b.pricePaise as number) < (a.pricePaise as number) ? b : a))
    : null
  const timed = rows.filter((r) => r.minTransitDays !== null)
  const fastest = timed.length
    ? timed.reduce((a, b) => ((b.minTransitDays as number) < (a.minTransitDays as number) ? b : a))
    : null
  /* Recommended: the cheapest priced courier, or the fastest when nobody quoted a price. */
  const recommended = cheapest ?? fastest
  return rows.map((r) => {
    const badges: CourierRateRow['badges'] = []
    if (cheapest === r) badges.push('cheapest')
    if (fastest === r) badges.push('fastest')
    if (recommended === r) badges.push('recommended')
    return { ...r, badges }
  })
}

export type CourierBookingRule =
  | { mode: 'cheapest' }
  | { mode: 'fastest' }
  | { mode: 'preferred'; providerId: string }
  | {
      mode: 'per_zone'
      /** First matching zone wins; a destination matching none uses `fallback`. */
      zones: Array<{ stateCodes: string[]; providerId: string }>
      fallback: 'cheapest' | 'fastest'
    }

/**
 * Which connected courier should book an order, from the store's default
 * rule. `rows` should come from `compareCourierRates` for the same route so
 * cheapest/fastest reflect real quotes; falls back to the first connected
 * courier when the rule can't resolve one (an empty comparison, or a
 * preferred/zone courier that is no longer connected).
 */
export function chooseCourier(
  rows: CourierRateRow[],
  providers: ShippingProvider[],
  rule: CourierBookingRule,
  destination?: { stateCode?: string | null | undefined } | undefined,
): ShippingProvider | null {
  const byId = (id: string) => providers.find((p) => p.id === id) ?? null

  if (rule.mode === 'preferred') return byId(rule.providerId) ?? providers[0] ?? null

  if (rule.mode === 'per_zone') {
    const state = destination?.stateCode?.trim().toUpperCase()
    const zone = state ? rule.zones.find((z) => z.stateCodes.includes(state)) : undefined
    const zoned = zone ? byId(zone.providerId) : null
    if (zoned) return zoned
    return chooseCourier(rows, providers, { mode: rule.fallback }, destination)
  }

  const byBadge = (badge: 'cheapest' | 'fastest') => rows.find((r) => r.badges.includes(badge))
  const primary = rule.mode === 'fastest' ? byBadge('fastest') : byBadge('cheapest')
  const secondary = rule.mode === 'fastest' ? byBadge('cheapest') : byBadge('fastest')
  const pick = primary ?? secondary
  return (pick && byId(pick.providerId)) || providers[0] || null
}
