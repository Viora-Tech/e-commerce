/** SOURCE OF TRUTH: one delivery option's courier pick — WHAT: which routes can carry an option
 * (`dropReason`), the strategy's pick (cheapest or fastest, ties to the earlier date and the
 * preferred carrier), a rule's preferred or forced courier first (`pickFor`), the rule's price on
 * the pick (`withRulePrice`) and the alternatives a rule offers / WHY: checkout, place order and
 * Try a PIN must pick the same courier at the same price. Pure. Split from resolve.ts.
 */
import { courierId, type DeliveryOption, type RouteRule, type RouteSelector } from './config'
import { byCheapest, type Candidate, priceFromPick, storeCost } from './courier-list'
import { datesFor, priceRoute } from './price'
import type { DropReason, PricedRoute, ResolveInput, WhyPicked } from './resolve-types'
import { type Route, selectorMatches } from './routes'
import {
  type CardPricer,
  type RulePriceContext,
  withRulePrice,
  withSeparateCodFee,
} from './rule-price'
import { poolAllows, type RulePool } from './rules'

export const optionAllows = (option: DeliveryOption, route: Route): boolean => {
  // The courier list's switches: a courier not turned on (new ones start off) never shows.
  const allow = option.couriers.allow
  if (allow != null && !allow.includes(courierId(route.carrierKey, route.speed))) return false
  const r = option.routes
  if (r.mode === 'any') return true
  const hit = r.selectors.some((s) => selectorMatches(route, s))
  return r.mode === 'allow' ? hit : !hit
}

/**
 * The routes an option can use for a cart: its own (its courier switches and its speed; a
 * courier list takes every speed), plus the preferred or forced route of any rule the cart
 * matches, whatever its speed. A rule's courier wins: mice preferring Delhivery Air ship by Air
 * on a Standard card (owner, 27 Nov 2026).
 */
export function optionCandidates(
  routes: readonly Route[],
  option: DeliveryOption,
  listed: boolean,
  rules: readonly RouteRule[],
): Route[] {
  const named = rules.flatMap((r) => (r.defaultRoute ? [r.defaultRoute] : []))
  return routes.filter(
    (r) =>
      (optionAllows(option, r) && (listed || r.speed === option.speed)) ||
      named.some((s) => selectorMatches(r, s)),
  )
}

export type Need = {
  insured: boolean
  cod: boolean
  /** A rule requires insurance: the store pays it under a rule's Free or Fixed price. */
  required?: boolean | undefined
}

/**
 * Why this route cannot carry the option, or null when it can. Order matters for the trace.
 * `ruleRoute`: a rule names this route as its preferred or forced courier, so the option's own
 * courier switches and speed do not keep it out (a rule's courier wins, owner 27 Nov 2026). The
 * rule pool, the PIN and the rest still apply.
 */
function dropReason(
  route: Route,
  option: DeliveryOption,
  pool: RulePool,
  input: ResolveInput,
  need: Need,
  ruleRoute = false,
): DropReason | null {
  if (!ruleRoute && !optionAllows(option, route)) return 'not_allowed'
  if (!ruleRoute && route.speed !== option.speed && option.couriers.show !== 'list')
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

export type PickResult = {
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
export function pickFor(
  routes: Route[],
  option: DeliveryOption,
  pool: RulePool,
  input: ResolveInput,
  need: Need,
  ruleNames: Map<string, string>,
  /** The cart's product rule prices for this option; null: the option's own price. */
  rulePrice: RulePriceContext | null = null,
): PickResult {
  const def = pool.defaultRoute
  const dropped = new Map<string, DropReason | null>()
  const fits: Candidate[] = []
  const forcedFits: Candidate[] = []
  for (const route of routes) {
    const named = def !== null && selectorMatches(route, def.selector)
    const isForced = named && def.force
    /* A preferred route is one of the option's own, whatever its speed: first when it fits; when
       it cannot reach the PIN the strategy picks the next courier the rules allow (owner, 27 Nov
       2026). A forced route stays out of the usual routes, which price it (#1782). */
    const reason = dropReason(route, option, pool, input, need, named && !def.force)
    const forcedReason = isForced ? dropReason(route, option, pool, input, need, true) : reason
    /* A rule's price, or a COD charge shown on its own line, starts from the prepaid price:
       the charge is added once, after the pick (`finish`). */
    const codInPrice = need.cod && rulePrice === null && option.cod.fee !== 'separate'
    const priced = forcedReason ? null : priceRoute(route, option, input, need.insured, codInPrice)
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
  /** The pick at the rule's price, or with its COD charge on its own line. */
  const finish = (c: Candidate): Candidate => {
    if (rulePrice) {
      const priced = withRulePrice(c.priced, c.route, option, rulePrice, {
        insured: need.insured,
        cod: need.cod,
        required: need.required === true,
      })
      return { route: c.route, priced }
    }
    // Free shipping stays free on COD without a rule price, as when the charge is included.
    const waived = option.price.source === 'free' || c.priced.pricePaise === 0
    if (need.cod && option.cod.fee === 'separate' && !waived) {
      return { route: c.route, priced: withSeparateCodFee(c.priced, c.route) }
    }
    return c
  }
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
    return { fits, dropped, picked: { winner: finish(winner), why: ruleWhy(true) }, forced: true }
  }
  // A preferred courier that cannot reach the PIN is skipped: the next one goes first, at the
  // rule's price (owner, 20 Nov 2026).
  const defaults = def ? fits.filter((c) => selectorMatches(c.route, def.selector)) : []
  const fromRule = defaults.length ? pickByStrategy(defaults, option) : null
  const picked = fromRule
    ? { winner: fromRule.winner, why: ruleWhy(false) }
    : pickByStrategy(fits, option)
  return {
    fits,
    dropped,
    picked: picked ? { winner: finish(picked.winner), why: picked.why } : null,
    forced: false,
  }
}

/** The best route for each alternative the rule offers, not the pick itself. */
export function alternativesFor(
  fits: Candidate[],
  selectors: readonly RouteSelector[],
  option: DeliveryOption,
  winner: Candidate,
  /** The pick is priced by a product rule: each alternative is that price plus its difference. */
  rulePriced = false,
  /** A Fixed rule names couriers' own prices (`ruleCardPricer`). */
  cardPrice: CardPricer | null = null,
): PricedRoute[] {
  const out: PricedRoute[] = []
  for (const sel of selectors) {
    const best = pickByStrategy(
      fits.filter((c) => selectorMatches(c.route, sel) && c.route.key !== winner.route.key),
      option,
    )
    if (best && !out.some((p) => p.route.key === best.winner.route.key)) {
      const fromPick = priceFromPick(best.winner, winner, option)
      if (!rulePriced) out.push(best.winner.priced)
      else out.push(cardPrice ? cardPrice(best.winner, fromPick) : fromPick)
    }
  }
  return out
}
