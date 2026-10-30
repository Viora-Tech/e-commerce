/** SOURCE OF TRUTH: combo deal amount — WHAT: which combos (sets of products or variants with quantities) a cart holds, how many times each, and what they take off / WHY: the Combo deal discount type (#995); the evaluator in `evaluate.ts` calls it so checkout, the order and tests share one sum */
import type { DiscountCombo } from '@commerce/db'
import type { DiscountCartLine } from './evaluate'

/** How often one combo applied and what it saved, for the summary and tests. */
export type ComboUse = { combo: number; times: number; savingPaise: number }

export type ComboMatch = { amountPaise: number; uses: ComboUse[] }

/** Round half away from zero, like the other discount maths. */
const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n))

const lineMatches = (line: DiscountCartLine, scope: DiscountCombo['scope'], id: string): boolean =>
  scope === 'variants' ? line.variantId === id : line.productId === id

/** What one full set saves when its units cost `grossPaise`: never below zero or above the set. */
export function comboSaving(combo: DiscountCombo, grossPaise: number): number {
  const raw =
    combo.method === 'price'
      ? grossPaise - combo.value
      : combo.method === 'percent'
        ? roundHalfUp((grossPaise * combo.value) / 10_000)
        : combo.value
  return Math.max(0, Math.min(raw, grossPaise))
}

/**
 * Take one set of `combo` from what is left, dearest units first (a product combo whose
 * variants differ in price saves the shopper most on the dearer ones). Returns the units
 * taken per line and their price, or null when the set does not fit.
 */
function takeSet(
  lines: DiscountCartLine[],
  left: number[],
  combo: DiscountCombo,
): { taken: number[]; grossPaise: number } | null {
  const taken = lines.map(() => 0)
  let grossPaise = 0
  for (const item of combo.items) {
    let need = item.quantity
    const order = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => lineMatches(l, combo.scope, item.id))
      .sort((a, b) => b.l.unitPricePaise - a.l.unitPricePaise)
    for (const { l, i } of order) {
      if (need === 0) break
      const free = (left[i] ?? 0) - (taken[i] ?? 0)
      const use = Math.min(free, need)
      if (use <= 0) continue
      taken[i] = (taken[i] ?? 0) + use
      grossPaise += use * l.unitPricePaise
      need -= use
    }
    if (need > 0) return null
  }
  return { taken, grossPaise }
}

/**
 * What a combo deal takes off a cart. Each combo applies once per full set the cart holds,
 * and no unit counts towards two sets.
 *
 * Overlapping combos (two combos sharing a product) make the true best split a packing
 * problem. We use a greedy pass instead, which is exact for combos that do not overlap and
 * close for those that do: every round, each combo is priced for one more set from the units
 * still free, the combo that saves the most for that set wins (ties go to the earlier combo),
 * its units are used up, and the round repeats until no combo fits or none saves anything.
 * Each round uses at least one unit, so it always ends.
 */
export function comboAmount(lines: DiscountCartLine[], combos: DiscountCombo[]): ComboMatch {
  const left = lines.map((l) => Math.max(0, l.quantity))
  const uses: ComboUse[] = combos.map((_, combo) => ({ combo, times: 0, savingPaise: 0 }))
  const usable = combos.filter((c) => c.items.length > 0 && c.items.every((i) => i.quantity >= 1))
  if (usable.length === 0) return { amountPaise: 0, uses: [] }

  for (;;) {
    let best: { index: number; taken: number[]; saving: number } | null = null
    for (const [index, combo] of combos.entries()) {
      if (!usable.includes(combo)) continue
      const set = takeSet(lines, left, combo)
      if (!set) continue
      const saving = comboSaving(combo, set.grossPaise)
      if (saving > 0 && (best === null || saving > best.saving)) {
        best = { index, taken: set.taken, saving }
      }
    }
    if (best === null) break
    for (const [i, n] of best.taken.entries()) left[i] = (left[i] ?? 0) - n
    const use = uses[best.index]
    if (use) {
      use.times++
      use.savingPaise += best.saving
    }
  }
  const applied = uses.filter((u) => u.times > 0)
  return { amountPaise: applied.reduce((n, u) => n + u.savingPaise, 0), uses: applied }
}
