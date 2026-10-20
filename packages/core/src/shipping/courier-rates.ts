import {
  computeDeliveryEstimate,
  type DispatchPolicy,
  describeCourierFailure,
  type RateCharge,
  type RateOption,
  type RateQuery,
  type ShippingProvider,
} from '@commerce/shipping'

/**
 * Multi-courier rate comparison and booking-rule selection for the Create
 * shipment flow (order page, Orders → Shipments, bulk booking). Pure functions
 * over whatever couriers the store connected - no database, no clock - so the
 * flow, the bulk booking service and the tests all run the same code.
 *
 * One row per bookable service: a courier with `quoteOptions` gets a row for each one
 * (Delhivery Surface and Express; every carrier inside Shiprocket or RapidShyp, named
 * "Delhivery Surface (Shiprocket)" so the merchant sees who carries it and who books it),
 * and the row's `serviceId` goes back into the booking. A courier with only `quoteRate`
 * gets one row, as before. A courier without a live price still gets a row - transit
 * time from serviceability, price left null and shown as "rate on booking" rather than
 * guessed at.
 */

/**
 * Why a courier can't take this parcel, when it can't. `not_serviceable`: it said no to the
 * PIN code. `no_cod`: it serves the PIN but not cash on delivery, and this parcel is COD.
 * `unreachable`: neither its rate nor its serviceability call answered.
 */
export type CourierProblem = 'not_serviceable' | 'no_cod' | 'unreachable'

export type CourierRateRow = {
  /** Unique per row: the courier's id, plus its service when it quoted several. */
  optionKey: string
  providerId: string
  /** The connected courier account's name ("Shiprocket"): what the rate table groups by. */
  providerName: string
  /** What the merchant reads: "Delhivery Surface", "Bluedart Air (Shiprocket)". */
  providerLabel: string
  /** Passed back when booking this row; null books the courier's own default. */
  serviceId: string | null
  /** What the courier itemised in its price; empty when it gave a total only. */
  charges: RateCharge[]
  chargeableWeightGrams: number | null
  /** Null when this courier has no live price quote for this route ("rate on booking"). */
  pricePaise: number | null
  minTransitDays: number | null
  maxTransitDays: number | null
  /** Null when serviceability did not answer. */
  codAvailable: boolean | null
  /** Null when this courier can take the parcel. A row with a problem is never recommended. */
  problem: CourierProblem | null
  /** The courier's own reason, or the app's wording for a failure. Never shown to shoppers. */
  problemDetail: string | null
  /** Latest expected delivery date, "YYYY-MM-DD", once `datedCourierRows` has run. */
  deliveryBy: string | null
  /** True when `deliveryBy` comes from the store's usual transit days, not the courier. */
  etaFromSettings: boolean
  badges: Array<'cheapest' | 'fastest' | 'recommended'>
  /** Booked at the courier's counter (India Post): the merchant types the tracking number. */
  needsTrackingNumber?: boolean | undefined
}

/**
 * Ask every connected courier for its price, transit time and COD support on one route.
 * One courier's failure (timeout, auth, a route it doesn't serve) never blanks the rest of
 * the table - it just gets a row that says why.
 */
export async function compareCourierRates(
  providers: ShippingProvider[],
  query: RateQuery,
): Promise<CourierRateRow[]> {
  const rows = await Promise.all(providers.map((provider) => quoteOneCourier(provider, query)))
  return assignBadges(rows.flat())
}

/** "Delhivery Surface" for a direct courier, "Bluedart Air (Shiprocket)" through an
 *  aggregator: the carrier first, who books it in brackets. */
export function rateOptionLabel(providerLabel: string, option: RateOption): string {
  return option.carrier === null
    ? `${providerLabel} ${option.serviceLabel}`
    : `${option.serviceLabel} (${providerLabel})`
}

async function quoteOneCourier(
  provider: ShippingProvider,
  query: RateQuery,
): Promise<CourierRateRow[]> {
  const rows = (provider.quoteOptions && (await quoteEveryService(provider, query))) || [
    await quoteSingle(provider, query),
  ]
  return provider.requiresTrackingNumber
    ? rows.map((r) => ({ ...r, needsTrackingNumber: true }))
    : rows
}

/**
 * One row per service the courier offers, or null when the options call failed or came back
 * empty, so the caller falls back to the single-quote row (which says why it can't book).
 * Serviceability is asked alongside, as for one row: it is what says "no" to a PIN code
 * and, for a courier whose options don't say, whether cash on delivery is collected.
 */
async function quoteEveryService(
  provider: ShippingProvider,
  query: RateQuery,
): Promise<CourierRateRow[] | null> {
  const quoteOptions = provider.quoteOptions as NonNullable<ShippingProvider['quoteOptions']>
  const [listed, served] = await Promise.allSettled([
    quoteOptions.call(provider, query),
    provider.checkServiceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
    }),
  ])
  const options = listed.status === 'fulfilled' ? listed.value : []
  const service = served.status === 'fulfilled' ? served.value : null
  if (!options.length || (service && !service.serviceable)) return null
  return options.map((o) => {
    const codAvailable = o.codAvailable ?? service?.codAvailable ?? null
    const row: CourierRateRow = {
      optionKey: `${provider.id}:${o.serviceId}`,
      providerId: provider.id,
      providerName: provider.label,
      providerLabel: rateOptionLabel(provider.label, o),
      serviceId: o.serviceId,
      charges: o.charges,
      chargeableWeightGrams: o.chargeableWeightGrams,
      pricePaise: o.pricePaise,
      minTransitDays: o.minTransitDays,
      maxTransitDays: o.maxTransitDays,
      codAvailable,
      problem: null,
      problemDetail: null,
      deliveryBy: null,
      etaFromSettings: false,
      badges: [],
    }
    return query.paymentMode === 'cod' && codAvailable === false
      ? { ...row, problem: 'no_cod' as const }
      : row
  })
}

async function quoteSingle(provider: ShippingProvider, query: RateQuery): Promise<CourierRateRow> {
  const base: CourierRateRow = {
    optionKey: provider.id,
    providerId: provider.id,
    providerName: provider.label,
    providerLabel: provider.label,
    serviceId: null,
    charges: [],
    chargeableWeightGrams: null,
    pricePaise: null,
    minTransitDays: null,
    maxTransitDays: null,
    codAvailable: null,
    problem: null,
    problemDetail: null,
    deliveryBy: null,
    etaFromSettings: false,
    badges: [],
  }
  /* Both questions at once: the rate call carries the price, serviceability carries COD
     support and the "no" for a PIN code the courier does not reach. */
  const [quoted, served] = await Promise.allSettled([
    provider.quoteRate ? provider.quoteRate(query) : Promise.resolve(null),
    provider.checkServiceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
    }),
  ])
  const quote = quoted.status === 'fulfilled' ? quoted.value : null
  const service = served.status === 'fulfilled' ? served.value : null

  if (!quote && !service) {
    const failure = served.status === 'rejected' ? served.reason : null
    return { ...base, problem: 'unreachable', problemDetail: describeCourierFailure(failure) }
  }
  if (service && !service.serviceable) {
    return { ...base, problem: 'not_serviceable', problemDetail: service.reason }
  }
  const row: CourierRateRow = {
    ...base,
    pricePaise: quote?.pricePaise ?? null,
    minTransitDays: quote?.minTransitDays ?? service?.minTransitDays ?? null,
    maxTransitDays: quote?.maxTransitDays ?? service?.maxTransitDays ?? null,
    codAvailable: service ? service.codAvailable : null,
  }
  if (query.paymentMode === 'cod' && row.codAvailable === false) {
    return { ...row, problem: 'no_cod' }
  }
  return row
}

/** Cheapest and fastest among the couriers that can take the parcel; recommended is the
 *  cheapest priced one, else the fastest, else the first courier that can take it. */
function assignBadges(rows: CourierRateRow[]): CourierRateRow[] {
  const bookable = rows.filter((r) => r.problem === null)
  const priced = bookable.filter((r) => r.pricePaise !== null)
  const cheapest = priced.length
    ? priced.reduce((a, b) => ((b.pricePaise as number) < (a.pricePaise as number) ? b : a))
    : null
  const timed = bookable.filter((r) => r.minTransitDays !== null)
  const fastest = timed.length
    ? timed.reduce((a, b) => ((b.minTransitDays as number) < (a.minTransitDays as number) ? b : a))
    : null
  const recommended = cheapest ?? fastest ?? bookable[0] ?? null
  return rows.map((r) => {
    const badges: CourierRateRow['badges'] = []
    if (cheapest === r) badges.push('cheapest')
    if (fastest === r) badges.push('fastest')
    if (recommended === r) badges.push('recommended')
    return { ...r, badges }
  })
}

/**
 * Turn each bookable row's transit days into a delivery date with the store's dispatch
 * calendar (cutoff, working days, holidays). A courier that gave no transit time gets the
 * store's usual one, flagged `etaFromSettings` so the flow can say it is an estimate.
 */
export function datedCourierRows(
  rows: CourierRateRow[],
  policy: DispatchPolicy & { defaultMinTransitDays: number; defaultMaxTransitDays: number },
  now: Date,
): CourierRateRow[] {
  return rows.map((r) => {
    if (r.problem) return r
    const fromSettings = r.minTransitDays === null || r.maxTransitDays === null
    try {
      const estimate = computeDeliveryEstimate({
        now,
        minTransitDays: r.minTransitDays ?? policy.defaultMinTransitDays,
        maxTransitDays: r.maxTransitDays ?? policy.defaultMaxTransitDays,
        policy,
      })
      return { ...r, deliveryBy: estimate.latestDate, etaFromSettings: fromSettings }
    } catch {
      // A calendar with no working days cannot produce a date; the row stays undated.
      return r
    }
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
