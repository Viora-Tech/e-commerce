import { buildMatrix, productBoxOf, variantTitle } from '@commerce/core/catalog'
import { emptyVariant, type OptionRow, type VariantRow } from './form-state'

/** Options that take part in the matrix: at least one non-blank value. A half-typed option waits. */
export function matrixOptions(options: OptionRow[]): OptionRow[] {
  return options.filter((o) => o.values.some((v) => v.trim()))
}

/** Option name -> value for one row, keyed case-insensitively (blank names fall back to position). */
function valuesByName(options: OptionRow[], optionValues: string[]): Map<string, string> {
  return new Map(
    options.map((o, i) => [o.name.trim().toLowerCase() || `#${i}`, optionValues[i] ?? '']),
  )
}

/** Every option both rows know about has the same value (vacuously true with none shared). */
function agrees(a: Map<string, string>, b: Map<string, string>): boolean {
  for (const [key, value] of a) {
    if (b.has(key) && b.get(key) !== value) return false
  }
  return true
}

/** True for a combination every value of which the options already offered before this edit. */
function deletedCombination(
  next: OptionRow[],
  prev: OptionRow[],
  rowCount: number,
): (combo: string[]) => boolean {
  // Nothing to have deleted on a fresh product (no rows) or when the option set changed shape.
  if (rowCount === 0 || prev.length === 0 || next.length !== prev.length) return () => false
  const prevValues = new Map(
    prev.map((o) => [o.name.trim().toLowerCase(), new Set(o.values.map((v) => v.trim()))]),
  )
  return (combo) =>
    next.every((o, i) => prevValues.get(o.name.trim().toLowerCase())?.has(combo[i] ?? '') === true)
}

/**
 * Rebuilds the variant matrix after an options edit, carrying existing rows (and so their ids,
 * prices, SKUs and stock) over wherever they still fit. A row keeps its place when its
 * combination survives; otherwise it moves to the first new combination that agrees with it
 * on every option both share. So the default variant becomes the first row when the first
 * option arrives, "S" becomes "S / Red" when Colour is added, and one of "S / Red" and
 * "S / Blue" becomes "S" when Colour goes. Rows `variants` were built from `before`'s
 * matrix options; `dropped` are the rows nothing took over.
 */
export function reconcileVariants(
  after: OptionRow[],
  before: OptionRow[],
  variants: VariantRow[],
): { variants: VariantRow[]; dropped: VariantRow[] } {
  const nextOptions = matrixOptions(after)
  const prevOptions = matrixOptions(before)
  const combos = buildMatrix(
    nextOptions.map((o) => ({ name: o.name, values: o.values.map((value) => ({ value })) })),
  )
  const used = new Set<number>()
  const taken: (number | undefined)[] = combos.map((combo) => {
    const title = variantTitle(combo)
    const i = variants.findIndex((v, j) => !used.has(j) && variantTitle(v.optionValues) === title)
    if (i !== -1) used.add(i)
    return i === -1 ? undefined : i
  })
  const prevKeys = variants.map((v) => valuesByName(prevOptions, v.optionValues))
  combos.forEach((combo, c) => {
    if (taken[c] !== undefined) return
    const keys = valuesByName(nextOptions, combo)
    const i = variants.findIndex((_, j) => !used.has(j) && agrees(prevKeys[j] ?? new Map(), keys))
    if (i === -1) return
    used.add(i)
    taken[c] = i
  })
  /* A combination built only from values the options already had, with no row, was deleted
     (bulk Delete, or a Shopify product imported without it): it stays deleted. New values
     still get their rows. */
  const deleted = deletedCombination(nextOptions, prevOptions, variants.length)
  const template = variants[0]
  const productBox = productBoxOf(variants)
  const rows: VariantRow[] = []
  combos.forEach((combo, c) => {
    const i = taken[c]
    const kept = i === undefined ? undefined : variants[i]
    if (kept) rows.push({ ...kept, optionValues: combo })
    else if (!deleted(combo)) rows.push(emptyVariant(combo, template, productBox))
  })
  return {
    variants: rows,
    dropped: variants.filter((_, j) => !used.has(j)),
  }
}
