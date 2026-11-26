/** SOURCE OF TRUTH: splitting one parcel by product rules — WHAT: `ruleGroups` says whether a
 * parcel's products are under rules with no courier in common and, if so, which products ship
 * together (one group per set of rules that share a courier) / WHY: owner, 21 Nov 2026: "split
 * only when rules have nothing in common". A glass pad that ships only by Delhivery and a mouse
 * that ships only by Blue Dart go as two parcels, each on its own courier, instead of one rule
 * overruling the other. Whenever any courier is allowed by every product's rules the parcel
 * stays whole, exactly as before. Pure.
 *
 * Rules:
 * - The option that decides is the one a rule price applies to: the courier list's option, else
 *   the first enabled Standard option. Other options are priced per group as they come.
 * - The pool is the same as `rulePool`'s: the option's own routes for these answers (any speed
 *   for a list) plus the rules' preferred or forced routes (`optionCandidates`), each item under only its most specific rules (`matchRules`).
 * - Grouping: items under the same winning rules form a group; groups are merged, largest
 *   first, into the first group whose pool still shares a courier with theirs. Items no rule
 *   matches take any courier and join the largest group.
 */
import type { DeliveryConfig, DeliveryOption, RouteRule } from './config'
import { optionCandidates } from './pick'
import { type ProviderAnswer, type Route, routesFromAnswers, selectorMatches } from './routes'
import { type CartItemFacts, matchRules } from './rules'

/** The option a split is decided for: the courier list's, else the first enabled Standard one. */
export function ruleSplitOption(
  config: Pick<DeliveryConfig, 'layout' | 'options'>,
): DeliveryOption | null {
  const sorted = [...config.options].sort((a, b) => a.position - b.position)
  if (config.layout === 'list') return sorted.find((o) => o.enabled) ?? null
  return sorted.find((o) => o.enabled && o.speed === 'standard') ?? null
}

/** The candidate route keys every one of `rules` allows. */
function poolOf(rules: readonly RouteRule[], candidates: readonly Route[]): Set<string> {
  return new Set(
    candidates
      .filter((route) => rules.every((r) => r.routes.some((s) => selectorMatches(route, s))))
      .map((r) => r.key),
  )
}

const shares = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].some((k) => b.has(k))

type Group = { products: string[]; pool: Set<string> }

/**
 * The product ids of each parcel this parcel should ship as, or null to keep it whole (one
 * group, no rules, no courier answers, or a courier every product's rules allow).
 */
export function ruleGroups(
  config: DeliveryConfig,
  items: readonly CartItemFacts[],
  answers: readonly ProviderAnswer[],
  weightGrams: number,
): string[][] | null {
  const option = ruleSplitOption(config)
  if (!option || items.length < 2) return null
  const listed = config.layout === 'list' || option.couriers.show === 'list'
  const all = matchRules(config.rules, option.id, items).winners
  const routes = routesFromAnswers(answers, config.routeSettings, weightGrams)
  const candidates = optionCandidates(routes, option, listed, all)
  if (candidates.length === 0) return null
  // Something in common (or no rule at all): one parcel, as today.
  if (all.length === 0 || poolOf(all, candidates).size > 0) return null

  const byRules = new Map<string, Group>()
  const loose: string[] = []
  for (const item of items) {
    const winners = matchRules(config.rules, option.id, [item]).winners
    if (winners.length === 0) {
      loose.push(item.productId)
      continue
    }
    const key = winners
      .map((r) => r.id)
      .sort()
      .join(',')
    const group = byRules.get(key) ?? { products: [], pool: poolOf(winners, candidates) }
    group.products.push(item.productId)
    byRules.set(key, group)
  }
  const merged: Group[] = []
  const bySize = [...byRules.values()].sort((a, b) => b.products.length - a.products.length)
  for (const g of bySize) {
    const into = merged.find((m) => shares(m.pool, g.pool))
    if (!into) {
      merged.push({ products: [...g.products], pool: new Set(g.pool) })
      continue
    }
    into.products.push(...g.products)
    into.pool = new Set([...into.pool].filter((k) => g.pool.has(k)))
  }
  if (merged.length < 2) return null
  const largest = merged.reduce((a, b) => (b.products.length > a.products.length ? b : a))
  largest.products.push(...loose)
  return merged.map((m) => m.products)
}
