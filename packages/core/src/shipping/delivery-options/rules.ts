/**
 * SOURCE OF TRUTH: product and collection route rules for a cart — WHAT: which rules a cart's
 * items match for one delivery option, and the route pool they leave (intersect every matching
 * rule; when nothing is common, the highest-placed rule wins) / WHY: "Glasspads ship with
 * Delhivery only" must decide the allowed routes before any option picks one. Pure.
 */
import type { RouteRule, RouteSelector } from './config'
import { type Route, selectorMatches } from './routes'

/** What a rule can match on, for one cart line's product. */
export type CartItemFacts = {
  productId: string
  collectionIds: readonly string[]
  tags: readonly string[]
  productType: string | null
}

const lower = (s: string) => s.trim().toLowerCase()

export function ruleMatchesItem(rule: RouteRule, item: CartItemFacts): boolean {
  const values = rule.target.values
  switch (rule.target.kind) {
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

/** The enabled rules this option's cart matches, highest-placed first. */
export function matchingRules(
  rules: readonly RouteRule[],
  optionId: string,
  items: readonly CartItemFacts[],
): RouteRule[] {
  return rules
    .filter((r) => r.enabled)
    .filter((r) => r.optionIds === 'all' || r.optionIds.includes(optionId))
    .filter((r) => items.some((i) => ruleMatchesItem(r, i)))
    .sort((a, b) => a.position - b.position)
}

export type RulePool = {
  /** The rules that shape the pool; empty when the cart matched none. */
  applied: RouteRule[]
  /** Rules the cart matched but which lost to a higher-placed rule (nothing in common). */
  overruled: RouteRule[]
  /** The default route of the highest applied rule that has one. */
  defaultRoute: { selector: RouteSelector; ruleId: string } | null
  alternatives: RouteSelector[]
  insuranceRequired: boolean
}

const allows = (rule: RouteRule, route: Route) => rule.routes.some((s) => selectorMatches(route, s))

/** Whether a route is in the pool the rules leave. */
export function poolAllows(pool: RulePool, route: Route): boolean {
  return pool.applied.every((r) => allows(r, route))
}

/**
 * Intersect the allowed routes of every matching rule over `candidates` (the option's own
 * routes). Something in common: every rule applies, and the default and alternatives are the
 * top rule's. Nothing in common: the highest-placed rule wins alone and the rest are recorded
 * as overruled, so Try a PIN can say which rule lost.
 */
export function rulePool(matching: readonly RouteRule[], candidates: readonly Route[]): RulePool {
  const top = matching[0]
  if (!top) {
    return {
      applied: [],
      overruled: [],
      defaultRoute: null,
      alternatives: [],
      insuranceRequired: false,
    }
  }
  const common = candidates.some((route) => matching.every((r) => allows(r, route)))
  const applied = common ? [...matching] : [top]
  const withDefault = applied.find((r) => r.defaultRoute)
  return {
    applied,
    overruled: common ? [] : matching.slice(1),
    defaultRoute: withDefault?.defaultRoute
      ? { selector: withDefault.defaultRoute, ruleId: withDefault.id }
      : null,
    alternatives: top.alternatives,
    insuranceRequired: applied.some((r) => r.insurance === 'required'),
  }
}
