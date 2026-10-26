import { formatPaise } from '@commerce/blocks'
import type { CommissionRule } from '@commerce/plugin-affiliates/settings'

/** Basis points as a short percent: 1000 → "10%", 1250 → "12.5%". */
export function bpPercent(bp: number): string {
  const pct = bp / 100
  return `${Number.isInteger(pct) ? pct : Number(pct.toFixed(2))}%`
}

/** A commission rule's amount for headlines: "10%" or "₹150". */
export function ruleAmount(rule: CommissionRule): string {
  return rule.type === 'percent' ? bpPercent(rule.bp) : formatPaise(rule.paise)
}
