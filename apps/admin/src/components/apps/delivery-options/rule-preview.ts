/** SOURCE OF TRUTH: the Product rule dialog's live line
 * WHAT:  What the rule being edited will do, in plain words, from the dialog's draft, price
 *        included: "Products in Mice ship free by Delhivery Air; shoppers can still pick Blue
 *        Dart Air or Amazon Surface".
 * WHY:   #1781 (owner, 17 Nov): the dialog should say what the rule does before it is saved;
 *        owner, 20 Nov: and what the shopper pays, so ticking a courier never reads as "free".
 * WHERE: rule-preview-line.tsx, under the rule's fields. Pure.
 */
import type { RouteSelector } from '@commerce/core/delivery-options'
import type { deliveryOptionsContent } from '@/data/delivery-options'
import type { deliveryPagesContent } from '@/data/delivery-options-pages'
import type { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { carrierName, ruleTargetLabel } from './format'
import { type RuleDraft, ruleInputOf } from './rule-draft'

type Copy = typeof deliveryOptionsContent
type Pages = typeof deliveryPagesContent
type Form = typeof deliveryRuleFormContent

export type RulePreview = { text: string; off: boolean }

const unique = (items: string[]) => [...new Set(items)]

/** "Delhivery Air", "Blue Dart Surface", "Ekart" (any speed). */
export function chipLabel(s: Pick<RouteSelector, 'carrier' | 'speed'>, copy: Copy, form: Form) {
  const name = carrierName(s.carrier, copy.routeDialog.anyCourier)
  return !s.speed || s.speed === 'any' ? name : `${name} ${form.chips.speeds[s.speed]}`
}

/** The draft's line, or null while it names no courier yet. */
export function rulePreview(
  draft: RuleDraft,
  copy: Copy,
  pages: Pages,
  form: Form,
  optionNames: ReadonlyMap<string, string>,
  money: (paise: number) => string,
): RulePreview | null {
  const rule = ruleInputOf(draft)
  if (rule.routes.length === 0) return null
  const p = pages.rulePreview
  const label = (s: RouteSelector) => chipLabel(s, copy, form)
  const who = rule.name || draft.titles.join(', ') || ruleTargetLabel(rule, copy)
  const preferred = rule.defaultRoute ?? null
  const price =
    rule.price.mode === 'free'
      ? p.free
      : rule.price.mode === 'fixed' && rule.price.fixedPaise != null
        ? p.fixed(money(rule.price.fixedPaise))
        : null

  let main: string
  if (preferred && rule.forceRoute) {
    main = p.always(who, label(preferred), price)
  } else if (preferred) {
    // The included courier hides its own other speed; the other couriers stay offered.
    const others = unique(rule.routes.filter((r) => r.carrier !== preferred.carrier).map(label))
    main = p.prefers(who, label(preferred), price)
    if (others.length > 0) main = `${main}; ${p.stillPick(p.either(others))}`
  } else {
    main = p.only(who, p.either(unique(rule.routes.map(label))), price)
  }

  const freeAbove = rule.price.freeAbovePaise
  const extras = [
    freeAbove != null && rule.price.mode !== 'free' ? p.freeAbove(money(freeAbove)) : null,
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
