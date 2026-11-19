/** SOURCE OF TRUTH: the delivery options engine — WHAT: `resolveDeliveryOptions(input)` turns the
 * store's options, its product route rules and the routes the connected apps answered for one
 * PIN code into the cards checkout shows (option, courier, dates, price, insurance, COD), with
 * a trace of every route's quote, why each was dropped and why the winner won / WHY: checkout,
 * `placeOrder` (from the quote snapshot) and the admin's Try a PIN must compute the same answer.
 * Pure: no database, no network, the clock is passed in.
 */
import { courierId, type DeliveryOption, type RouteSelector } from './config'
import { byCheapest, type Candidate, courierList, storeCost } from './courier-list'
import { optionCardTitle } from './labels'
import { cartProtect, cheapestZoneRate, datesFor, priceRoute } from './price'
import type {
  DeliveryResolveResult,
  DropReason,
  OptionTrace,
  PricedRoute,
  ResolvedOption,
  ResolveInput,
  TraceRoute,
  WhyPicked,
} from './resolve-types'
import { insurancePrice, type Route, routesFromAnswers, selectorMatches } from './routes'
import { matchRules, poolAllows, type RulePool, rulePool } from './rules'

const optionAllows = (option: DeliveryOption, route: Route): boolean => {
  // The courier list's switches: a courier not turned on (new ones start off) never shows.
  const allow = option.couriers.allow
  if (allow != null && !allow.includes(courierId(route.carrierKey, route.speed))) return false
  const r = option.routes
  if (r.mode === 'any') return true
  const hit = r.selectors.some((s) => selectorMatches(route, s))
  return r.mode === 'allow' ? hit : !hit
}

type Need = { insured: boolean; cod: boolean }

/**
 * Why this route cannot carry the option, or null when it can. Order matters for the trace.
 * `forced`: a rule forces this route (`forceRoute`), so the option's own courier switches and
 * speed do not keep it out.
 */
function dropReason(
  route: Route,
  option: DeliveryOption,
  pool: RulePool,
  input: ResolveInput,
  need: Need,
  forced = false,
): DropReason | null {
  if (!forced && !optionAllows(option, route)) return 'not_allowed'
  if (!forced && route.speed !== option.speed && option.couriers.show !== 'list')
    return 'wrong_speed'
  if (!poolAllows(pool, route)) return 'rule'
  if (!route.enabled) return 'disabled'
  if (!route.serviceable) return 'not_serviceable'
  if (route.costPaise === null && option.price.source !== 'zone') return 'no_price'
  if (need.insured && !route.insures) return 'no_insurance'
  if (need.cod && route.codAvailable === false) return 'no_cod'
  const max = option.eta.maxDays
  if (max != null && datesFor(route, option, input).transitMax > max) return 'over_max_eta'
  return null
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
  const first = sorted[0]
  if (!first) return null
  // The shopper sees one price per option: among the routes that charge them the same as the
  // first, the one that arrives first wins (Waimers saw Amazon Shipping on Thursday picked over
  // Delhivery on Wednesday at the same ₹0); the merchant's preferred courier wins only when the
  // price and the date are both equal (owner, 11 Nov). The store may pay a little more for it.
  // Fastest keeps its date: only same-day equals are swapped.
  const latest = (c: Candidate) => c.priced.latest ?? '9999-12-31'
  const preferred = (c: Candidate) =>
    option.preferCarrier ? Number(c.route.carrierKey !== option.preferCarrier) : 0
  // A Free option charges the shopper ₹0 for every route, so "the same price" there means the
  // same cost to the store; otherwise the store would pay for the fastest courier every time.
  const shopperPrice = (c: Candidate) =>
    option.price.source === 'free' ? storeCost(c) : c.priced.pricePaise
  const ties = sorted.filter(
    (c) =>
      shopperPrice(c) === shopperPrice(first) &&
      (option.strategy !== 'fastest' || c.priced.latest === first.priced.latest),
  )
  const best =
    ties.sort(
      (a, b) =>
        latest(a).localeCompare(latest(b)) || preferred(a) - preferred(b) || byFastest(a, b),
    )[0] ?? first
  const within = option.preferDirectWithinPaise
  if (within != null && best.route.channel === 'aggregator') {
    const direct = sorted.find(
      (c) =>
        c.route.channel === 'direct' &&
        storeCost(c) <= storeCost(best) + within &&
        (option.strategy !== 'fastest' || c.priced.latest === best.priced.latest),
    )
    if (direct) return { winner: direct, why: { kind: 'prefer_direct', withinPaise: within } }
  }
  return { winner: best, why: { kind: option.strategy } }
}

type PickResult = {
  fits: Candidate[]
  dropped: Map<string, DropReason | null>
  picked: { winner: Candidate; why: WhyPicked } | null
  /** A rule's `forceRoute` chose the winner: no other courier is offered. */
  forced: boolean
}

/**
 * One option's pick (prepaid or COD). A rule that forces its default route (and the route
 * serves the PIN) wins outright: priced at what the option would charge without it, the store
 * covering the difference (#1782). Else the rule default first when it fits, else the strategy.
 */
function pickFor(
  routes: Route[],
  option: DeliveryOption,
  pool: RulePool,
  input: ResolveInput,
  need: Need,
  ruleNames: Map<string, string>,
): PickResult {
  const def = pool.defaultRoute
  const dropped = new Map<string, DropReason | null>()
  const fits: Candidate[] = []
  const forcedFits: Candidate[] = []
  for (const route of routes) {
    const isForced = def?.force === true && selectorMatches(route, def.selector)
    const reason = dropReason(route, option, pool, input, need)
    const forcedReason = isForced ? dropReason(route, option, pool, input, need, true) : reason
    const priced = forcedReason ? null : priceRoute(route, option, input, need.insured, need.cod)
    dropped.set(route.key, forcedReason ?? (priced ? null : 'no_price'))
    if (!priced) continue
    if (!reason) fits.push({ route, priced })
    if (isForced) forcedFits.push({ route, priced })
  }
  const ruleWhy = (forced: boolean) => ({
    kind: 'rule_default' as const,
    ruleId: def?.ruleId ?? '',
    ruleName: ruleNames.get(def?.ruleId ?? '') ?? '',
    ...(forced ? { forced: true } : {}),
  })
  const forcedPick = forcedFits.length ? pickByStrategy(forcedFits, option) : null
  if (forcedPick) {
    // What the shopper would have paid: the option's own pick among its usual routes.
    const usual = pickByStrategy(fits, option)?.winner.priced ?? forcedPick.winner.priced
    const winner: Candidate = {
      route: forcedPick.winner.route,
      priced: {
        ...forcedPick.winner.priced,
        pricePaise: usual.pricePaise,
        listPricePaise: usual.listPricePaise,
        markupPaise: usual.markupPaise,
      },
    }
    return { fits, dropped, picked: { winner, why: ruleWhy(true) }, forced: true }
  }
  const defaults = def ? fits.filter((c) => selectorMatches(c.route, def.selector)) : []
  const fromRule = defaults.length ? pickByStrategy(defaults, option) : null
  const picked = fromRule
    ? { winner: fromRule.winner, why: ruleWhy(false) }
    : pickByStrategy(fits, option)
  return { fits, dropped, picked, forced: false }
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
    insurancePaise:
      priced?.insurancePaise ?? insurancePrice(route, input.cart.valuePaise, cartProtect(input)),
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

/** The shopper's tick, else the option's default. */
function wantsInsurance(option: DeliveryOption, input: ResolveInput): boolean {
  if (input.insure !== undefined) return input.insure
  if (input.declineInsurance === true) return false
  return option.insurance.default === 'on'
}

/** Whether `a` arrives strictly earlier than `b` (latest date, then earliest). */
function arrivesEarlier(a: ResolvedOption, b: ResolvedOption): boolean {
  if (!a.latest || !b.latest) return true
  if (a.latest !== b.latest) return a.latest < b.latest
  return !!a.earliest && !!b.earliest && a.earliest < b.earliest
}

/**
 * `compareSpeeds: false` leaves Express in even when it is not faster: a split cart's parcels
 * are resolved one by one and compared once added up (`resolveParcelDeliveries`).
 */
export function resolveDeliveryOptions(
  input: ResolveInput,
  opts: { compareSpeeds?: boolean } = {},
): DeliveryResolveResult {
  const { config, cart, answers } = input
  const allRoutes = routesFromAnswers(answers, config.routeSettings, cart.weightGrams)
  const anyFailed = answers.length === 0 || answers.some((a) => a.status === 'failed')
  const ruleNames = new Map(config.rules.map((r) => [r.id, r.name]))
  const options: ResolvedOption[] = []
  const traces: OptionTrace[] = []

  const sorted = [...config.options].sort((a, b) => a.position - b.position)
  // The courier list layout: the first enabled option alone, as a list of couriers.
  const listOptionId = config.layout === 'list' ? (sorted.find((o) => o.enabled)?.id ?? null) : null
  for (const saved of sorted) {
    const option: DeliveryOption =
      saved.id === listOptionId && saved.couriers.show !== 'list'
        ? { ...saved, couriers: { ...saved.couriers, show: 'list' } }
        : saved
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
    if (listOptionId !== null && option.id !== listOptionId) {
      traces.push({ ...base, hidden: 'list_layout' })
      continue
    }
    // The option hides every courier name: its cards show only the delivery promise (#1521).
    const routes = option.couriers.showNames
      ? allRoutes
      : allRoutes.map((r) => ({ ...r, showCarrier: false }))
    const listed = option.couriers.show === 'list'
    const candidates = routes.filter(
      (r) => optionAllows(option, r) && (listed || r.speed === option.speed),
    )
    const match = matchRules(config.rules, option.id, cart.items)
    const pool = rulePool(match.winners, candidates, match.outranked)
    const ins = option.insurance
    const offered =
      ins.onlyAbovePaise == null || (input.orderValuePaise ?? cart.valuePaise) >= ins.onlyAbovePaise
    const required = pool.insuranceRequired
    const insured = required || (offered && wantsInsurance(option, input))
    const codAllowed =
      option.speed === 'standard' && option.cod.mode === 'allowed' && input.policy.codAllowed

    const prepaid = pickFor(routes, option, pool, input, { insured, cod: false }, ruleNames)
    const pricedByKey = new Map(prepaid.fits.map((c) => [c.route.key, c.priced]))
    const won = prepaid.picked?.winner
    if (won) pricedByKey.set(won.route.key, won.priced)
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
    // A forced route carries the parcel alone: no alternatives, no other courier cards.
    const alternatives = prepaid.forced
      ? []
      : alternativesFor(prepaid.fits, pool.alternatives, option, winner.route.key)
    const codPick = codAllowed
      ? pickFor(routes, option, pool, input, { insured, cod: true }, ruleNames).picked
      : null
    const pick = winner.priced
    const listChoices = listed && !prepaid.forced ? courierList(prepaid.fits, winner, option) : []
    /* The tick: priced both ways, so "+₹X" is what ticking really adds after rounding. A route
       with no insurance rate prices insurance at ₹0, and then no tick shows. */
    const flipped =
      offered && !required
        ? pickFor(routes, option, pool, input, { insured: !insured, cod: false }, ruleNames).picked
        : null
    const insuredPick = insured ? pick : (flipped?.winner.priced ?? null)
    const insurancePaise = insuredPick ? insuredPick.insurancePaise : null
    const tick = flipped !== null && insuredPick !== null && (insurancePaise ?? 0) > 0
    const extra = flipped
      ? Math.max(
          0,
          insured
            ? pick.pricePaise - flipped.winner.priced.pricePaise
            : flipped.winner.priced.pricePaise - pick.pricePaise,
        )
      : null
    options.push({
      optionId: option.id,
      name: option.name,
      description: option.description ?? null,
      title: optionCardTitle(option, pick.route, listChoices.length > 0),
      speed: option.speed,
      source: winner.route.source,
      pick,
      pickedBy: why.kind === 'rule_default' ? `rule:${why.ruleId}` : 'strategy',
      why,
      choices: listChoices.length
        ? listChoices
        : alternatives.length
          ? [pick, ...alternatives]
          : [],
      layout: listChoices.length ? 'list' : 'one',
      pricePaise: pick.pricePaise,
      listPricePaise: pick.listPricePaise,
      earliest: pick.earliest,
      latest: pick.latest,
      etaEstimated: pick.etaEstimated,
      codAllowed: codAllowed && codPick !== null,
      cod: codPick?.winner.priced ?? null,
      insurance: {
        offered: tick,
        required,
        on: insured,
        pricePaise: insured ? pick.insurancePaise : insurancePaise,
        extraPaise: tick ? extra : null,
      },
      backupRate: null,
    })
    traces.push({ ...trace, winner: winner.route.key, why })
  }

  if (opts.compareSpeeds !== false) hideExpressNotFaster(options, traces, listOptionId !== null)

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

/**
 * Fixed options: an Express card whose pick does not arrive earlier than Standard's pick is
 * hidden (it would be the same promise at a higher price, e.g. PIN 131001 with a mouse, #1781).
 * The trace says `not_faster`. Backup cards and the list layout are left alone.
 */
export function hideExpressNotFaster(
  options: ResolvedOption[],
  traces: OptionTrace[],
  listLayout: boolean,
): void {
  if (listLayout) return
  const standard = options.find((o) => o.speed === 'standard' && o.pick !== null)
  if (!standard) return
  for (const o of [...options]) {
    if (o.speed !== 'express' || o.pick === null || o.layout === 'list') continue
    if (arrivesEarlier(o, standard)) continue
    options.splice(options.indexOf(o), 1)
    const t = traces.find((x) => x.optionId === o.optionId)
    if (t) t.hidden = 'not_faster'
  }
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
    layout: 'one',
    pricePaise: price,
    listPricePaise: rate?.listPricePaise ?? price,
    earliest: dated.earliest,
    latest: dated.latest,
    etaEstimated: true,
    codAllowed,
    cod: null,
    insurance: { offered: false, required: false, on: false, pricePaise: null, extraPaise: null },
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
