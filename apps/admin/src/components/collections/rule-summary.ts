import type { CollectionRules } from '@commerce/core/collections'
import { parseRupees } from '@commerce/money'
import type { collectionsListContent } from '@/data/collections'

type ListCopy = typeof collectionsListContent.list

/** "Tag is cloth, Price > ₹1,000": the conditions of an automatic collection on one line. */
export function ruleSummary(
  rules: CollectionRules,
  copy: ListCopy,
  money: (paise: number) => string,
): string {
  if (rules.conditions.length === 0) return copy.noRules
  return rules.conditions
    .map((c) => {
      const paise = c.field === 'price' || c.field === 'compare_at' ? parseRupees(c.value) : null
      const value = paise === null ? c.value : money(paise)
      return `${copy.ruleField[c.field]} ${copy.ruleOp[c.op]} ${value}`
    })
    .join(rules.match === 'all' ? ', ' : ' or ')
}
