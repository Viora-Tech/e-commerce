/** SOURCE OF TRUTH: product and collection route rules for a cart — WHAT: which rules a cart's
 * items match for one delivery option (for each product, only its most specific rules: product
 * > collection / tag / type > every product), and the route pool they leave (intersect the
 * winners; when nothing is common, the most specific, highest-placed rule wins), plus the
 * default route a rule may force / WHY: "Glasspads ship with Delhivery only" must decide the
 * allowed routes before any option picks one, and a rule for one product must beat a rule for
 * every product rather than be cut down by it (#1782). Pure.
 */
import { RULE_SPECIFICITY, type RouteRule, type RouteSelector } from './config'
import { type Route, selectorMatches } from './routes'

/** What a rule can match on, for one cart line's product. */
export type CartItemFacts = {
  productId: string
  collectionIds: readonly string[]
  tags: readonly string[]
  productType: string | null
  /** Shopify taxonomy category (`el-7-8-8`): what Delhivery Protect prices insurance by. */
  categoryId?: string | null | undefined
}

const lower = (s: string) => s.trim().toLowerCase()

export function ruleMatchesItem(rule: RouteRule, item: CartItemFacts): boolean {
  const values = rule.target.values
  switch (rule.target.kind) {
    case 'all':
      return true
    case 'products':
      return values.includes(item.productId)
    case 'collections':
      return item.collectionIds.some((c) => values.includes(c))
    case 'tags': {
      const wanted = new Set(values.map(lower))
      return item.tags.some((t) => wanted.has(lower(t)))
    }
    case 'types':
      return item.productType !== null && values.map(lower).includes(lower(item.productType))
  }
}

const specificity = (r: RouteRule) => RULE_SPECIFICITY[r.target.kind] ?? 0

/** Most specific first, then highest placed. */
const byRank = (a: RouteRule, b: RouteRule) =>
  specificity(b) - specificity(a) || a.position - b.position

export type RuleMatch = {
  /** The rules that win for at least one item, most specific and highest placed first. */
  winners: RouteRule[]
  /** Rules the cart matched that lost on every item to a more specific rule. */
  outranked: RouteRule[]
}

/**
 * The enabled rules this option's cart matches, split by specificity: for each item, only the
 * rules of the most specific kind that match it count. A Mouse product rule and an every-product
 * rule both matching the mouse: the product rule wins for the mouse; the every-product rule
 * still counts for a glasspad in the same cart.
 */
export function matchRules(
  rules: readonly RouteRule[],
  optionId: string,
  items: readonly CartItemFacts[],
): RuleMatch {
  const live = rules
    .filter((r) => r.enabled)
    .filter((r) => r.optionIds === 'all' || r.optionIds.includes(optionId))
  const matched = new Set<RouteRule>()
  const winning = new Set<RouteRule>()
  for (const item of items) {
    const hits = live.filter((r) => ruleMatchesItem(r, item))
    const best = Math.max(0, ...hits.map(specificity))
    for (const r of hits) {
      matched.add(r)
      if (specificity(r) === best) winning.add(r)
    }
  }
  return {
    winners: [...winning].sort(byRank),
    outranked: [...matched].filter((r) => !winning.has(r)).sort(byRank),
  }
}

/** The rules that shape this option's routes for the cart (`matchRules(...).winners`). */
export function matchingRules(
  rules: readonly RouteRule[],
  optionId: string,
  items: readonly CartItemFacts[],
): RouteRule[] {
  return matchRules(rules, optionId, items).winners
}

export type RulePool = {
  /** The rules that shape the pool; empty when the cart matched none. */
  applied: RouteRule[]
  /** Rules the cart matched but which lost: to a more specific rule, or nothing in common. */
  overruled: RouteRule[]
  /** The default route of the top applied rule that has one; `force`: its `forceRoute`. */
  defaultRoute: { selector: RouteSelector; ruleId: string; force: boolean } | null
  alternatives: RouteSelector[]
  insuranceRequired: boolean
}

const allows = (rule: RouteRule, route: Route) => rule.routes.some((s) => selectorMatches(route, s))

/** Whether a route is in the pool the rules leave. */
export function poolAllows(pool: RulePool, route: Route): boolean {
  return pool.applied.every((r) => allows(r, route))
}

/**
 * Intersect the allowed routes of every winning rule over `candidates` (the option's own
 * routes). Something in common: every rule applies, and the default and alternatives are the
 * top rule's. Nothing in common: the top rule (most specific, highest placed) wins alone and
 * the rest are recorded as overruled, so Try a PIN can say which rule lost. `outranked` (rules
 * a more specific one beat) are recorded as overruled too.
 */
export function rulePool(
  matching: readonly RouteRule[],
  candidates: readonly Route[],
  outranked: readonly RouteRule[] = [],
): RulePool {
  const ranked = [...matching].sort(byRank)
  const top = ranked[0]
  if (!top) {
    return {
      applied: [],
      overruled: [...outranked],
      defaultRoute: null,
      alternatives: [],
      insuranceRequired: false,
    }
  }
  const common = candidates.some((route) => ranked.every((r) => allows(r, route)))
  const applied = common ? ranked : [top]
  const withDefault = applied.find((r) => r.defaultRoute)
  return {
    applied,
    overruled: [...(common ? [] : ranked.slice(1)), ...outranked],
    defaultRoute: withDefault?.defaultRoute
      ? {
          selector: withDefault.defaultRoute,
          ruleId: withDefault.id,
          force: withDefault.forceRoute === true,
        }
      : null,
    alternatives: top.alternatives,
    insuranceRequired: applied.some((r) => r.insurance === 'required'),
  }
}
