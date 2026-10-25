import type { CommissionRule } from '@commerce/plugin-affiliates/settings'
import type { affiliatesContent } from '@/data/affiliates'

/** "10% of the sale" / "₹150 per order", in the member's language. */
export function ruleLabel(
  rule: CommissionRule,
  copy: Pick<typeof affiliatesContent.programs, 'percentRule' | 'flatRule'>,
  money: (paise: number) => string,
): string {
  return rule.type === 'percent'
    ? copy.percentRule(rule.bp / 100)
    : copy.flatRule(money(rule.paise))
}
