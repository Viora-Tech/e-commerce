/** SOURCE OF TRUTH: how an earning rule reads in the admin — WHAT: its name (the merchant's title, else the standard one) and its value line ("100 points", "1 point a day") / WHY: the Program page's rule rows and the rule sheet's shopper preview must say the same thing */
import type { loyaltyProgramContent } from '@/data/loyalty-program'
import type { loyaltyRulesContent } from '@/data/loyalty-rules'

type RuleLike = {
  type: string
  key: string
  title: string | null
  points: number
  settings?: unknown
}

type Names = Pick<typeof loyaltyRulesContent, 'platforms' | 'types'>

/** The standard name of a rule type (the platform's for social). */
export const standardName = (r: { type: string; key: string }, names: Names) =>
  (r.type === 'social' ? names.platforms[r.key] : names.types[r.type]) || r.type

/** The merchant's title, else the standard name. */
export const ruleName = (r: RuleLike, names: Names) => r.title?.trim() || standardName(r, names)

/** "100 points", "1 points a day", "20 points every 7 days in a row". */
export function ruleValue(
  r: RuleLike,
  c: (typeof loyaltyProgramContent)['rules'],
  days?: number,
): string {
  const s = (r.settings ?? {}) as { days?: number }
  if (r.type === 'daily_visit') return c.perDay(r.points)
  if (r.type === 'visit_streak') return c.streak(r.points, days ?? s.days ?? 7)
  if (r.type === 'product_review') return c.perProduct(r.points)
  if (r.type === 'birthday' || r.type === 'anniversary') return c.yearly(r.points)
  return c.points(r.points)
}
