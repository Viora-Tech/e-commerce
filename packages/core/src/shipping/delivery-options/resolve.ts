/**
 * SOURCE OF TRUTH: the delivery options engine — WHAT: `resolveDeliveryOptions(input)` turns the
 * store's options, its product route rules and the routes the connected apps answered for one
 * PIN code into the cards checkout shows (option, courier, dates, price, insurance, COD), with
 * a trace of every route's quote, why each was dropped and why the winner won / WHY: checkout,
 * `placeOrder` (from the quote snapshot) and the admin's Try a PIN must compute the same answer.
 * Pure: no database, no network, the clock is passed in.
 */
import { computeDeliveryEstimate, type DispatchPolicy } from '@commerce/shipping'
import type { ShippingRateOption } from '../rates'
import type { DeliveryConfig, DeliveryOption, RouteSelector } from './config'
import {
  insurancePrice,
  type ProviderAnswer,
  type Route,
  routesFromAnswers,
  selectorMatches,
} from './routes'
import { type CartItemFacts, matchingRules, poolAllows, type RulePool, rulePool } from './rules'

export type ZoneQuote =
  | { kind: 'not_configured' }
  | { kind: 'no_rates' }
  | { kind: 'rates'; options: ShippingRateOption[] }

export type ResolveInput = {
  config: DeliveryConfig
  cart: { valuePaise: number; weightGrams: number; items: readonly CartItemFacts[] }
  answers: readonly ProviderAnswer[]
  /** The store's zone rates for this address: the `zone` price and the Standard backup. */
  zone: ZoneQuote
  policy: DispatchPolicy & {
    defaultMinTransitDays: number
    defaultMaxTransitDays: number
    codAllowed: boolean
  }
  now: Date
  /** The shopper unticked "Insure this shipment". Never overrides a rule that requires it. */
  declineInsurance?: boolean | undefined
}

/** Why a route did not back an option. */
export type DropReason =
  | 'not_allowed'
  | 'wrong_speed'
  | 'rule'
  | 'disabled'
  | 'not_serviceable'
  | 'no_price'
  | 'no_insurance'
  | 'no_cod'
  | 'over_max_eta'

export type RouteSummary = Pick<
  Route,
  | 'key'
  | 'providerId'
  | 'providerLabel'
  | 'channel'
  | 'carrierKey'
  | 'carrier'
  | 'serviceId'
  | 'serviceLabel'
  | 'speed'
  | 'source'
>

export type PricedRoute = {
  route: RouteSummary
  /** What the shopper pays for shipping on this route. */
  pricePaise: number
  /** Before free-above: struck through when the option is free. */
  listPricePaise: number
  /** What the route quoted (before markup and insurance), for margin. */
  courierCostPaise: number
  markupPaise: number
  /** Insurance charged; null when the route's insurance rate is unknown (charged as ₹0). */
  insurancePaise: number | null
  insured: boolean
  earliest: string | null
  latest: string | null
  /** True when the dates come from the store's usual transit days, not the courier. */
  etaEstimated: boolean
}

export type WhyPicked =
  | { kind: 'cheapest' }
  | { kind: 'fastest' }
  | { kind: 'prefer_direct'; withinPaise: number }
  | { kind: 'rule_default'; ruleId: string; ruleName: string }
  | { kind: 'backup' }

export type ResolvedOption = {
  optionId: string
  name: string
  description: string | null
  /** "Express · Blue Dart"; just the option's name on backup. */
  title: string
  speed: DeliveryOption['speed']
  source: 'live' | 'cache' | 'backup'
  /** The route the card shows; null on backup (zone rate, no route saved). */
  pick: PricedRoute | null
  pickedBy: 'strategy' | `rule:${string}` | 'backup'
  why: WhyPicked
  /** Sub-choices when a rule allows alternatives: the pick first. Empty: no choice. */
  choices: PricedRoute[]
  pricePaise: number
  listPricePaise: number
  earliest: string | null
  latest: string | null
  etaEstimated: boolean
  /** Express (and any prepaid-only option) refuses cash on delivery. */
  codAllowed: boolean
  /** Standard picked again with "COD needed": what the order books and charges on COD. */
  cod: PricedRoute | null
  insurance: {
    /** Show the checkbox (offered and not required by a rule). */
    offered: boolean
    required: boolean
    on: boolean
    /** Insurance in the price; null when the route's rate is not filled in. */
    pricePaise: number | null
  }
  /** On backup, the zone rate charged. */
  backupRate: ShippingRateOption | null
}

export type TraceRoute = {
  key: string
  carrier: string
  providerLabel: string
  channel: Route['channel']
  serviceLabel: string
  speed: Route['speed']
  costPaise: number | null
  insurancePaise: number | null
  latest: string | null
  etaEstimated: boolean
  codAvailable: boolean | null
  insures: boolean
  source: Route['source']
  ms: number | null
  dropped: DropReason | null
}

export type OptionTrace = {
  optionId: string
  name: string
  rulesApplied: Array<{ id: string; name: string }>
  rulesOverruled: Array<{ id: string; name: string }>
  routes: TraceRoute[]
  winner: string | null
  why: WhyPicked | null
  /** Shown as "hidden: …" in Try a PIN. */
  hidden: 'no_route' | 'couriers_down' | 'no_zone_rate' | 'disabled' | null
}

export type DeliveryResolveResult = {
  /** `unserviceable`: every route truly said no. `none`: nothing to show (use zone rates). */
  status: 'options' | 'unserviceable' | 'none'
  options: ResolvedOption[]
  trace: {
    options: OptionTrace[]
    providers: Array<
      Pick<
        ProviderAnswer,
        'providerId' | 'providerLabel' | 'status' | 'source' | 'ms' | 'error' | 'serviceable'
      >
    >
  }
}

/** ₹10 in paise. */
const TEN_RUPEES = 1000

/** Round up to the next ₹10: ₹141 → ₹150, ₹150 stays. */
export const roundUpToTenRupees = (paise: number): number =>
  Math.ceil(Math.max(0, paise) / TEN_RUPEES) * TEN_RUPEES

const summary = (r: Route): RouteSummary => ({
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

type Dated = {
  earliest: string | null
  latest: string | null
  estimated: boolean
  transitMax: number
}

function datesFor(route: Route | null, option: DeliveryOption, input: ResolveInput): Dated {
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
function priceRoute(
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

function cheapestZoneRate(zone: ZoneQuote): ShippingRateOption | null {
  if (zone.kind !== 'rates' || zone.options.length === 0) return null
  return zone.options.reduce((a, b) => (b.pricePaise < a.pricePaise ? b : a))
}

const optionAllows = (option: DeliveryOption, route: Route): boolean => {
  const r = option.routes
  if (r.mode === 'any') return true
  const hit = r.selectors.some((s) => selectorMatches(route, s))
  return r.mode === 'allow' ? hit : !hit
}

/** Why this route cannot carry the option, or null when it can. Order matters for the trace. */
function dropReason(
  route: Route,
  option: DeliveryOption,
  pool: RulePool,
  input: ResolveInput,
  need: { insured: boolean; cod: boolean },
): DropReason | null {
  if (!optionAllows(option, route)) return 'not_allowed'
  if (route.speed !== option.speed) return 'wrong_speed'
  if (!poolAllows(pool, route)) return 'rule'
  if (!route.enabled) return 'disabled'
  if (!route.serviceable) return 'not_serviceable'
  if (route.costPaise === null && option.price.source === 'route') return 'no_price'
  if (need.insured && !route.insures) return 'no_insurance'
  if (need.cod && route.codAvailable === false) return 'no_cod'
  const max = option.eta.maxDays
  if (max != null && datesFor(route, option, input).transitMax > max) return 'over_max_eta'
  return null
}

type Candidate = { route: Route; priced: PricedRoute }

/** Cheapest: lowest cost to the store (insurance included), tie → direct. */
function byCheapest(a: Candidate, b: Candidate): number {
  const cost = (c: Candidate) => c.priced.courierCostPaise + (c.priced.insurancePaise ?? 0)
  return (
    cost(a) - cost(b) ||
    Number(a.route.channel !== 'direct') - Number(b.route.channel !== 'direct') ||
    a.route.key.localeCompare(b.route.key)
  )
}

/** Fastest: earliest latest-arrival, a real ETA beats an estimate, then cheapest. */
function byFastest(a: Candidate, b: Candidate): number {
  const latest = (c: Candidate) => c.priced.latest ?? '9999-12-31'
  return (
    latest(a).localeCompare(latest(b)) ||
    Number(a.priced.etaEstimated) - Number(b.priced.etaEstimated) ||
    byCheapest(a, b)
  )
}

function pickByStrategy(
  fits: Candidate[],
  option: DeliveryOption,
): { winner: Candidate; why: WhyPicked } | null {
  const order = option.strategy === 'fastest' ? byFastest : byCheapest
  const sorted = [...fits].sort(order)
  const best = sorted[0]
  if (!best) return null
  const within = option.preferDirectWithinPaise
  if (within != null && best.route.channel === 'aggregator') {
    const cost = (c: Candidate) => c.priced.courierCostPaise + (c.priced.insurancePaise ?? 0)
    const direct = sorted.find(
      (c) =>
        c.route.channel === 'direct' &&
        cost(c) <= cost(best) + within &&
        (option.strategy !== 'fastest' || c.priced.latest === best.priced.latest),
    )
    if (direct) return { winner: direct, why: { kind: 'prefer_direct', withinPaise: within } }
  }
  return { winner: best, why: { kind: option.strategy } }
}

/** One option's pick (prepaid or COD), the rule default first when it fits. */
function pickFor(
  routes: Route[],
  option: DeliveryOption,
  pool: RulePool,
  input: ResolveInput,
  need: { insured: boolean; cod: boolean },
  ruleNames: Map<string, string>,
) {
  const dropped = new Map<string, DropReason | null>()
  const fits: Candidate[] = []
  for (const route of routes) {
    const reason = dropReason(route, option, pool, input, need)
    const priced = reason ? null : priceRoute(route, option, input, need.insured, need.cod)
    if (!reason && !priced) dropped.set(route.key, 'no_price')
    else dropped.set(route.key, reason)
    if (priced) fits.push({ route, priced })
  }
  const def = pool.defaultRoute
  const defaults = def ? fits.filter((c) => selectorMatches(c.route, def.selector)) : []
  const fromRule = defaults.length ? pickByStrategy(defaults, option) : null
  const picked = fromRule
    ? {
        winner: fromRule.winner,
        why: {
          kind: 'rule_default' as const,
          ruleId: def?.ruleId ?? '',
          ruleName: ruleNames.get(def?.ruleId ?? '') ?? '',
        },
      }
    : pickByStrategy(fits, option)
  return { fits, dropped, picked }
}

/** The best route for each alternative the rule offers, not the pick itself. */
function alternativesFor(
  fits: Candidate[],
  selectors: readonly RouteSelector[],
  option: DeliveryOption,
  winnerKey: string,
): PricedRoute[] {
  const out: PricedRoute[] = []
  for (const sel of selectors) {
    const best = pickByStrategy(
      fits.filter((c) => selectorMatches(c.route, sel) && c.route.key !== winnerKey),
      option,
    )
    if (best && !out.some((p) => p.route.key === best.winner.route.key))
      out.push(best.winner.priced)
  }
  return out
}

function traceRoute(
  route: Route,
  dropped: DropReason | null,
  priced: PricedRoute | undefined,
  option: DeliveryOption,
  input: ResolveInput,
): TraceRoute {
  const dated = priced ?? null
  const d = dated ? null : datesFor(route, option, input)
  return {
    key: route.key,
    carrier: route.carrier,
    providerLabel: route.providerLabel,
    channel: route.channel,
    serviceLabel: route.serviceLabel,
    speed: route.speed,
    costPaise: route.costPaise,
    insurancePaise: priced?.insurancePaise ?? insurancePrice(route, input.cart.valuePaise),
    latest: dated?.latest ?? d?.latest ?? null,
    etaEstimated: dated?.etaEstimated ?? d?.estimated ?? true,
    codAvailable: route.codAvailable,
    insures: route.insures,
    source: route.source,
    ms: route.ms,
    dropped,
  }
}

const asRef = (r: { id: string; name: string }) => ({ id: r.id, name: r.name })

export function resolveDeliveryOptions(input: ResolveInput): DeliveryResolveResult {
  const { config, cart, answers } = input
  const routes = routesFromAnswers(answers, config.routeSettings, cart.weightGrams)
  const anyFailed = answers.length === 0 || answers.some((a) => a.status === 'failed')
  const ruleNames = new Map(config.rules.map((r) => [r.id, r.name]))
  const options: ResolvedOption[] = []
  const traces: OptionTrace[] = []

  const sorted = [...config.options].sort((a, b) => a.position - b.position)
  for (const option of sorted) {
    const base: OptionTrace = {
      optionId: option.id,
      name: option.name,
      rulesApplied: [],
      rulesOverruled: [],
      routes: [],
      winner: null,
      why: null,
      hidden: null,
    }
    if (!option.enabled) {
      traces.push({ ...base, hidden: 'disabled' })
      continue
    }
    const candidates = routes.filter((r) => optionAllows(option, r) && r.speed === option.speed)
    const pool = rulePool(matchingRules(config.rules, option.id, cart.items), candidates)
    const ins = option.insurance
    const offered =
      ins.default === 'on' && (ins.onlyAbovePaise == null || cart.valuePaise >= ins.onlyAbovePaise)
    const required = pool.insuranceRequired
    const insured = required || (offered && !input.declineInsurance)
    const codAllowed =
      option.speed === 'standard' && option.cod.mode === 'allowed' && input.policy.codAllowed

    const prepaid = pickFor(routes, option, pool, input, { insured, cod: false }, ruleNames)
    const pricedByKey = new Map(prepaid.fits.map((c) => [c.route.key, c.priced]))
    const trace: OptionTrace = {
      ...base,
      rulesApplied: pool.applied.map(asRef),
      rulesOverruled: pool.overruled.map(asRef),
      routes: routes.map((r) =>
        traceRoute(r, prepaid.dropped.get(r.key) ?? null, pricedByKey.get(r.key), option, input),
      ),
    }

    if (!prepaid.picked) {
      /* Nothing fits. "Down" means none of this option's routes could even be asked: a
         courier failed and no answered route is serviceable. Express then hides; Standard
         falls back to the store's zone rate with no route saved. */
      const down = anyFailed && !candidates.some((r) => r.serviceable && poolAllows(pool, r))
      const backup =
        down && option.speed === 'standard' ? backupOption(option, input, codAllowed) : null
      if (backup) {
        options.push(backup)
        traces.push({ ...trace, why: { kind: 'backup' } })
      } else {
        traces.push({
          ...trace,
          hidden: down
            ? option.speed === 'standard'
              ? 'no_zone_rate'
              : 'couriers_down'
            : 'no_route',
        })
      }
      continue
    }

    const { winner, why } = prepaid.picked
    const alternatives = alternativesFor(prepaid.fits, pool.alternatives, option, winner.route.key)
    const codPick = codAllowed
      ? pickFor(routes, option, pool, input, { insured, cod: true }, ruleNames).picked
      : null
    const pick = winner.priced
    options.push({
      optionId: option.id,
      name: option.name,
      description: option.description ?? null,
      title: `${option.name} · ${pick.route.carrier}`,
      speed: option.speed,
      source: winner.route.source,
      pick,
      pickedBy: why.kind === 'rule_default' ? `rule:${why.ruleId}` : 'strategy',
      why,
      choices: alternatives.length ? [pick, ...alternatives] : [],
      pricePaise: pick.pricePaise,
      listPricePaise: pick.listPricePaise,
      earliest: pick.earliest,
      latest: pick.latest,
      etaEstimated: pick.etaEstimated,
      codAllowed: codAllowed && codPick !== null,
      cod: codPick?.winner.priced ?? null,
      insurance: {
        offered: offered && !required,
        required,
        on: insured,
        pricePaise: pick.insurancePaise,
      },
      backupRate: null,
    })
    traces.push({ ...trace, winner: winner.route.key, why })
  }

  const providers = answers.map((a) => ({
    providerId: a.providerId,
    providerLabel: a.providerLabel,
    status: a.status,
    source: a.source,
    ms: a.ms,
    error: a.error,
    serviceable: a.serviceable,
  }))
  const allSaidNo =
    answers.length > 0 && answers.every((a) => a.status === 'ok' && a.serviceable === false)
  const status = options.length ? 'options' : allSaidNo ? 'unserviceable' : 'none'
  return { status, options, trace: { options: traces, providers } }
}

/** Standard when couriers are down: the store's zone rate and usual transit days. */
function backupOption(
  option: DeliveryOption,
  input: ResolveInput,
  codAllowed: boolean,
): ResolvedOption | null {
  if (input.zone.kind === 'no_rates') return null
  const rate = cheapestZoneRate(input.zone)
  const price = rate?.pricePaise ?? 0
  const dated = datesFor(null, option, input)
  return {
    optionId: option.id,
    name: option.name,
    description: option.description ?? null,
    title: option.name,
    speed: option.speed,
    source: 'backup',
    pick: null,
    pickedBy: 'backup',
    why: { kind: 'backup' },
    choices: [],
    pricePaise: price,
    listPricePaise: rate?.listPricePaise ?? price,
    earliest: dated.earliest,
    latest: dated.latest,
    etaEstimated: true,
    codAllowed,
    cod: null,
    insurance: { offered: false, required: false, on: false, pricePaise: null },
    backupRate: rate,
  }
}

/** The priced route a shopper's choice means: a sub-choice by key, else the option's pick. */
export function chosenRoute(
  option: ResolvedOption,
  routeKey: string | null | undefined,
  payment: 'prepaid' | 'cod',
): PricedRoute | null {
  if (payment === 'cod' && option.cod) return option.cod
  if (routeKey) {
    const sub = option.choices.find((c) => c.route.key === routeKey)
    if (sub) return sub
  }
  return option.pick
}
