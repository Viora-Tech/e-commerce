import { variantTitle } from '@commerce/core/catalog'
import { rupees } from '@/data/products'
import { stockOf, type VariantRow } from './form-state'

/** Variants sharing one value of the grouped option ("Mini"), summed up for the group row. */
export type VariantGroup = {
  value: string
  /** Indexes into the full variant list, in list order. */
  indexes: number[]
  /** Lowest and highest typed price in minor units; null when no row has a price. */
  minPrice: number | null
  maxPrice: number | null
  /** Units on hand across the group's tracked rows. */
  stock: number
}

/** One line of the variants table: a group's summary row, or a variant row (`nested` under a group). */
export type MatrixLine =
  | { kind: 'group'; group: VariantGroup; open: boolean }
  | { kind: 'variant'; index: number; nested: boolean }

/** Grouping kicks in by itself past this many variants, when there are two options or more. */
const AUTO_GROUP_FROM = 9

/** The option to group by when the merchant has not picked: the first one on a big matrix, else none. */
export function defaultGroupBy(optionCount: number, variantCount: number): number | null {
  return optionCount >= 2 && variantCount >= AUTO_GROUP_FROM ? 0 : null
}

/** The variant's title or SKU contains every word of the search, ignoring case. */
export function matchesVariant(variant: VariantRow, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = `${variantTitle(variant.optionValues)} ${variant.sku}`.toLowerCase()
  return words.every((w) => haystack.includes(w))
}

/** Groups `indexes` by the value at `optionIndex`, in the order values first appear. */
export function groupVariants(
  variants: VariantRow[],
  optionIndex: number,
  indexes: number[],
): VariantGroup[] {
  const groups = new Map<string, VariantGroup>()
  for (const i of indexes) {
    const v = variants[i]
    if (!v) continue
    const value = v.optionValues[optionIndex] ?? ''
    const group = groups.get(value) ?? {
      value,
      indexes: [],
      minPrice: null,
      maxPrice: null,
      stock: 0,
    }
    group.indexes.push(i)
    const price = v.price.trim() === '' ? null : rupees.toPaise(v.price)
    if (price != null) {
      group.minPrice = group.minPrice == null ? price : Math.min(group.minPrice, price)
      group.maxPrice = group.maxPrice == null ? price : Math.max(group.maxPrice, price)
    }
    group.stock += stockOf([v])
    groups.set(value, group)
  }
  return [...groups.values()]
}

/**
 * What the variants table draws: rows matching the search, flat or under one summary row per
 * value of the grouped option. A search opens every group, so matches are never hidden.
 */
export function matrixLines(
  variants: VariantRow[],
  options: { query: string; groupBy: number | null; open: string[] },
): MatrixLine[] {
  const indexes = variants.flatMap((v, i) => (matchesVariant(v, options.query) ? [i] : []))
  if (options.groupBy == null) {
    return indexes.map((index) => ({ kind: 'variant', index, nested: false }))
  }
  const searching = options.query.trim() !== ''
  return groupVariants(variants, options.groupBy, indexes).flatMap((group): MatrixLine[] => {
    const open = searching || options.open.includes(group.value)
    const head: MatrixLine = { kind: 'group', group, open }
    if (!open) return [head]
    return [
      head,
      ...group.indexes.map((index) => ({ kind: 'variant' as const, index, nested: true })),
    ]
  })
}

/** Variant indexes the lines show, for "select all" to tick only what is on screen. */
export function shownIndexes(lines: MatrixLine[]): number[] {
  return lines.flatMap((line) =>
    line.kind === 'variant' ? [line.index] : line.open ? [] : line.group.indexes,
  )
}
