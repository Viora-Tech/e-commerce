/** SOURCE OF TRUTH: the delivery options engine — WHAT: `resolveDeliveryOptions(input)` turns the
 * store's options, its product route rules and the routes the connected apps answered for one
 * PIN code into the cards checkout shows (option, courier, dates, price, insurance, COD), with
 * a trace of every route's quote, why each was dropped and why the winner won / WHY: checkout,
 * `placeOrder` (from the quote snapshot) and the admin's Try a PIN must compute the same answer.
 * Pure: no database, no network, the clock is passed in.
 */
import type { DeliveryOption, RouteSelector } from './config'
import { cheapestZoneRate, datesFor, priceRoute } from './price'
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
import { matchingRules, poolAllows, type RulePool, rulePool } from './rules'

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
  if (route.speed !== option.speed && option.couriers.show !== 'list') return 'wrong_speed'
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
  const cheapest = sorted[0]
  if (!cheapest) return null
  // The shopper sees one price per option: among the routes that charge them the same as the
  // cheapest, the one that arrives first wins (Waimers saw Amazon Shipping on Thursday picked
  // over Delhivery on Wednesday at the same ₹0). The store may pay a little more for it.
  const best =
    option.strategy === 'fastest'
      ? cheapest
      : ([...sorted]
          .filter((c) => c.priced.pricePaise === cheapest.priced.pricePaise)
          .sort(byFastest)[0] ?? cheapest)
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

/** Rupees rounded up so they end in 9 (₹37 → ₹39, ₹40 → ₹49); paise in, paise out. */
function upToNine(paise: number): number {
  if (paise <= 0) return 0
  const rupees = Math.ceil(paise / 100)
  return (rupees + ((9 - (rupees % 10) + 10) % 10)) * 100
}

/**
 * The cards of a `list` option: the pick at its own price, every other allowed courier at that
 * price plus what it costs the store more (rounded to ₹…9 when asked). One card per courier and
 * speed (a carrier offered by two apps keeps the cheaper); couriers beaten on both price and
 * date are dropped when asked; at most `max`, cheapest first.
 */
function courierList(fits: Candidate[], winner: Candidate, option: DeliveryOption): PricedRoute[] {
  const cost = (c: Candidate) => c.priced.courierCostPaise + (c.priced.insurancePaise ?? 0)
  const base = winner.priced
  const seen = new Set<string>([`${winner.route.carrierKey}:${winner.route.speed}`])
  const rest: PricedRoute[] = []
  for (const c of [...fits].sort(byCheapest)) {
    const id = `${c.route.carrierKey}:${c.route.speed}`
    if (c.route.key === winner.route.key || seen.has(id)) continue
    seen.add(id)
    const more = Math.max(0, cost(c) - cost(winner))
    const extra = option.couriers.roundTo9 ? upToNine(more) : Math.ceil(more / 100) * 100
    rest.push({
      ...c.priced,
      pricePaise: base.pricePaise + extra,
      listPricePaise: base.listPricePaise + extra,
    })
  }
  const later = (p: PricedRoute) => p.latest ?? '9999-12-31'
  const all = [base, ...rest]
  const kept = option.couriers.hideSlowerDearer
    ? all.filter(
        (p) =>
          p === base ||
          !all.some(
            (q) =>
              q !== p &&
              q.pricePaise <= p.pricePaise &&
              later(q) <= later(p) &&
              (q.pricePaise < p.pricePaise || later(q) < later(p)),
          ),
      )
    : all
  return kept.slice(0, option.couriers.max)
}

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
    const listed = option.couriers.show === 'list'
    const candidates = routes.filter(
      (r) => optionAllows(option, r) && (listed || r.speed === option.speed),
    )
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
    const listChoices = listed ? courierList(prepaid.fits, winner, option) : []
    options.push({
      optionId: option.id,
      name: option.name,
      description: option.description ?? null,
      title: pick.route.showCarrier ? `${option.name} · ${pick.route.carrier}` : option.name,
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
    layout: 'one',
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
