/** SOURCE OF TRUTH: the Product rule dialog's quick starts and courier chips
 * WHAT:  The courier and speed chips a rule can tick (`ruleChips`: the store's connected
 *        couriers, plus any a saved rule names that no app offers now), a new rule's first
 *        state (every connected chip ticked, owner 20 Nov 2026), and the three quick starts
 *        that fill the form: free with a preferred courier (mice), one courier only and free
 *        (glass pads), paid with the cheapest first (skates).
 * WHY:   The owner unticks what he doesn't want rather than building a list from nothing.
 * WHERE: rule-dialog.tsx, rule-presets-bar.tsx, rule-courier-chips.tsx. Pure.
 */
import type { DeliverySpeed } from '@commerce/core/delivery-options'
import type { CourierRow } from './courier-rows'
import { type RuleSuggestion, toRupees } from './format'
import { type RuleDraft, splitChip } from './rule-draft'

/** One chip: a courier at one speed. */
export type RuleChip = {
  id: string
  carrier: string
  speed: DeliverySpeed
  /** No connected app offers it now (a saved rule names it). */
  missing: boolean
}

export const RULE_PRESETS = ['freePreferred', 'oneFree', 'paidCheapest'] as const
export type RulePreset = (typeof RULE_PRESETS)[number]

/** Connected chips (direct couriers first, as the courier list sorts them), then the draft's
 *  own chips no app offers now. */
export function ruleChips(rows: readonly CourierRow[], ticked: readonly string[]): RuleChip[] {
  const out: RuleChip[] = rows.map((r) => ({
    id: r.id,
    carrier: r.carrierKey,
    speed: r.speed,
    missing: false,
  }))
  for (const id of ticked) {
    if (out.some((c) => c.id === id)) continue
    const { carrier, speed } = splitChip(id)
    if (speed !== 'any') out.push({ id, carrier, speed, missing: true })
  }
  return out
}

/** A new rule: every connected chip ticked. */
export const seededDraft = (d: RuleDraft, connected: readonly RuleChip[]): RuleDraft => ({
  ...d,
  chips: connected.filter((c) => !c.missing).map((c) => c.id),
})

const pick = (chips: readonly RuleChip[], carrier: string, speed: DeliverySpeed) =>
  chips.find((c) => c.carrier === carrier && c.speed === speed)

/** The form filled the preset's way, from the connected chips (else the ticked ones). */
export function applyPreset(d: RuleDraft, preset: RulePreset, chips: readonly RuleChip[]): RuleDraft {
  const live = chips.filter((c) => !c.missing)
  const all = live.length > 0 ? live.map((c) => c.id) : d.chips
  const unpriced = { freeAboveOn: false, freeAbove: '', fixed: '' }
  if (preset === 'paidCheapest') {
    return { ...d, ...unpriced, chips: all, preferred: null, forceRoute: false, priceMode: 'option' }
  }
  if (preset === 'freePreferred') {
    const air =
      pick(live, 'delhivery', 'express') ?? live.find((c) => c.speed === 'express') ?? live[0]
    return {
      ...d,
      ...unpriced,
      chips: all,
      preferred: air?.id ?? all[0] ?? null,
      forceRoute: false,
      priceMode: 'free',
    }
  }
  const one = pick(live, 'delhivery', 'standard')?.id ?? all[0]
  return {
    ...d,
    ...unpriced,
    chips: one ? [one] : [],
    preferred: one ?? null,
    forceRoute: one !== undefined,
    priceMode: 'free',
  }
}

/** A suggestion from Shipping rates as a new rule's first fields (couriers are seeded later). */
export function seedOf(s: RuleSuggestion): Partial<RuleDraft> {
  return {
    name: s.name,
    kind: s.target.kind,
    values: s.target.values,
    titles: s.titles,
    priceMode: s.price.mode,
    fixed: toRupees(s.price.fixedPaise),
    freeAboveOn: s.price.freeAbovePaise != null,
    freeAbove: toRupees(s.price.freeAbovePaise),
  }
}
