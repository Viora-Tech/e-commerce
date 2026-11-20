/** SOURCE OF TRUTH: the Product rule dialog's live line
 * WHAT:  What the rule being edited will do, in plain words, from the dialog's draft:
 *        "Mice ship by Delhivery Express / Air; shoppers can still pick Blue Dart or Ekart".
 * WHY:   #1781 (owner, 17 Nov): the dialog should say what the rule does before it is saved.
 *        Prices need the rule saved (Try a PIN prices saved rules), so the line says who
 *        carries the products, not what they cost.
 * WHERE: rule-dialog.tsx, under the rule's fields. Pure.
 */
import type { RouteSelector } from '@commerce/core/delivery-options'
import type { deliveryOptionsContent } from '@/data/delivery-options'
import type { deliveryPagesContent } from '@/data/delivery-options-pages'
import { ruleTargetLabel, selectorLabel } from './format'
import { type RuleDraft, ruleInputOf } from './rule-draft'

type Copy = typeof deliveryOptionsContent
type Pages = typeof deliveryPagesContent

export type RulePreview = { text: string; off: boolean }

const unique = (items: string[]) => [...new Set(items)]

/** The draft's line, or null while it names no courier yet. */
export function rulePreview(
  draft: RuleDraft,
  copy: Copy,
  pages: Pages,
  optionNames: ReadonlyMap<string, string>,
): RulePreview | null {
  const rule = ruleInputOf(draft)
  if (rule.routes.length === 0) return null
  const p = pages.rulePreview
  const label = (s: RouteSelector) => selectorLabel(s, copy)
  const who = rule.name || draft.titles.join(', ') || ruleTargetLabel(rule, copy)
  const preferred = rule.defaultRoute ?? null

  let main: string
  if (preferred && rule.forceRoute) {
    main = p.always(who, label(preferred))
  } else if (preferred) {
    // The preferred courier hides its own other speed; the other couriers stay offered.
    const others = unique(rule.routes.filter((r) => r.carrier !== preferred.carrier).map(label))
    main = p.prefers(who, label(preferred))
    if (others.length > 0) main = `${main}; ${p.stillPick(p.either(others))}`
  } else {
    main = p.only(who, p.either(unique(rule.routes.map(label))))
  }

  const extras = [
    rule.insurance === 'required' ? p.insured : null,
    rule.optionIds === 'all'
      ? null
      : p.inOptions(p.either(rule.optionIds.map((id) => optionNames.get(id) ?? '?'))),
  ].filter((x): x is string => x !== null)

  return {
    text: `${main}${extras.length > 0 ? ` (${extras.join(', ')})` : ''}.`,
    off: !rule.enabled,
  }
}
