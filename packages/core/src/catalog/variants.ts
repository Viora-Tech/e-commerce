/**
 * Pure variant-matrix logic. No I/O: the service decides what to do with the
 * diff, this decides what the diff is.
 */

export type OptionInput = {
  id?: string | undefined
  name: string
  values: { id?: string | undefined; value: string }[]
}

export type VariantInput = {
  id?: string | undefined
  /** One value per option, in option order. Empty for a product without options. */
  optionValues: string[]
  sku?: string | null | undefined
  barcode?: string | null | undefined
  pricePaise: number
  mrpPaise?: number | null | undefined
  costPaise?: number | null | undefined
  taxable?: boolean | undefined
  trackInventory?: boolean | undefined
  weightGrams?: number | null | undefined
  /** Customs fields for international labels. */
  hsCode?: string | null | undefined
  countryOfOrigin?: string | null | undefined
  gstRatePercent?: number | null | undefined
  /** Absolute on-hand count when the merchant edits it inline. */
  onHand?: number | undefined
  mediaId?: string | null | undefined
}

export type ExistingVariant = { id: string; title: string; archivedAt: Date | null }

export type VariantDiff = {
  /** Existing id → input, matched by id or by option combination. */
  update: { id: string; input: VariantInput }[]
  create: VariantInput[]
  /** Existing variants no longer in the matrix. Whether they are archived or deleted is the service's call. */
  remove: ExistingVariant[]
  /** Archived variants whose combination came back: revive instead of duplicating. */
  revive: { id: string; input: VariantInput }[]
}

export const DEFAULT_VARIANT_TITLE = 'Default'

/** "Red / Small" — the same string the Shopify import produced, so old rows match. */
export function variantTitle(optionValues: string[]): string {
  const parts = optionValues.map((v) => v.trim()).filter(Boolean)
  return parts.length ? parts.join(' / ') : DEFAULT_VARIANT_TITLE
}

/** Cartesian product of option values, in option order. One "Default" row when there are no options. */
export function buildMatrix(options: OptionInput[]): string[][] {
  const lists = options.map((o) => o.values.map((v) => v.value.trim()).filter(Boolean))
  if (lists.length === 0 || lists.some((l) => l.length === 0)) return [[]]
  return lists.reduce<string[][]>(
    (acc, values) => acc.flatMap((row) => values.map((v) => [...row, v])),
    [[]],
  )
}

export function diffVariants(existing: ExistingVariant[], inputs: VariantInput[]): VariantDiff {
  const byId = new Map(existing.map((v) => [v.id, v]))
  const byTitle = new Map(existing.map((v) => [v.title, v]))
  const seen = new Set<string>()
  const diff: VariantDiff = { update: [], create: [], remove: [], revive: [] }

  for (const input of inputs) {
    const title = variantTitle(input.optionValues)
    const match =
      (input.id && byId.get(input.id)) ||
      (byTitle.get(title) && !seen.has(byTitle.get(title)?.id ?? '')
        ? byTitle.get(title)
        : undefined)
    if (!match) {
      diff.create.push(input)
      continue
    }
    seen.add(match.id)
    if (match.archivedAt) diff.revive.push({ id: match.id, input })
    else diff.update.push({ id: match.id, input })
  }
  for (const v of existing) {
    if (!seen.has(v.id) && !v.archivedAt) diff.remove.push(v)
  }
  return diff
}

/** Validation the schema cannot express: every variant must fit the options. */
export function variantErrors(options: OptionInput[], variants: VariantInput[]): string[] {
  const errors: string[] = []
  const names = options.map((o) => o.name.trim())
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    errors.push('Option names must be unique')
  }
  for (const [i, o] of options.entries()) {
    const values = o.values.map((v) => v.value.trim()).filter(Boolean)
    if (!names[i]) errors.push(`Option ${i + 1} needs a name`)
    if (values.length === 0) errors.push(`Option "${o.name}" needs at least one value`)
    if (new Set(values.map((v) => v.toLowerCase())).size !== values.length) {
      errors.push(`Option "${o.name}" has duplicate values`)
    }
  }
  const titles = new Set<string>()
  for (const v of variants) {
    if (v.optionValues.length !== options.length) {
      errors.push(`Variant "${variantTitle(v.optionValues)}" does not match the options`)
    }
    const t = variantTitle(v.optionValues)
    if (titles.has(t)) errors.push(`Duplicate variant "${t}"`)
    titles.add(t)
  }
  if (variants.length === 0) errors.push('A product needs at least one variant')
  return errors
}
