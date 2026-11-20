/** SOURCE OF TRUTH: the Product rules page's order advice and delivery warnings
 * WHAT:  Which rule should sit above which (a more specific rule above a broader one: "Mice (a
 *        collection) above All products"), the order "Sort by most specific" saves, and rules
 *        that can block delivery: one allowing a single courier, worse when it is for all
 *        products.
 * WHY:   Owner, 20 Nov 2026: the list should read in the order checkout applies rules
 *        (`RULE_SPECIFICITY`), and a one-courier rule leaves PIN codes with no delivery.
 * WHERE: rule-order-card.tsx on rules-page.tsx. Pure.
 */
import { RULE_SPECIFICITY, type RouteRule } from '@commerce/core/delivery-options'

const rank = (r: Pick<RouteRule, 'target'>) => RULE_SPECIFICITY[r.target.kind] ?? 0

/** Most specific first; rules of the same kind keep their order. */
export function sortBySpecificity<T extends Pick<RouteRule, 'target' | 'position'>>(
  rules: readonly T[],
): T[] {
  return rules
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(b.r) - rank(a.r) || a.i - b.i)
    .map((x) => x.r)
}

export type OrderAdvice = { specific: RouteRule; broad: RouteRule }

/** Each broader rule placed above a more specific one, nearest pair first. */
export function orderAdvice(rules: readonly RouteRule[]): OrderAdvice[] {
  const out: OrderAdvice[] = []
  rules.forEach((broad, i) => {
    for (const specific of rules.slice(i + 1)) {
      if (rank(specific) > rank(broad)) out.push({ specific, broad })
    }
  })
  return out
}

export type RuleWarning = { rule: RouteRule; kind: 'oneCourier' | 'allOneCourier'; carrier: string }

/** Enabled rules that allow a single courier. */
export function blockingRules(rules: readonly RouteRule[]): RuleWarning[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled) return []
    const carriers = [...new Set(rule.routes.map((r) => r.carrier))]
    const [carrier] = carriers
    if (carriers.length !== 1 || !carrier || carrier === 'any') return []
    return [{ rule, kind: rule.target.kind === 'all' ? 'allOneCourier' : 'oneCourier', carrier }]
  })
}
