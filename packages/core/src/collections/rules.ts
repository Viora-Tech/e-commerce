/**
 * Automatic collection rules.
 *
 * Pure and dependency free so client components can import it: the admin's
 * condition builder and the server-side sync both evaluate the same function,
 * which is what keeps the live "matches N products" preview honest.
 */

export const COLLECTION_FIELDS = [
  'title',
  'type',
  'vendor',
  'tag',
  'price',
  'compare_at',
  'stock',
  'weight',
  'variant_title',
] as const
export type CollectionField = (typeof COLLECTION_FIELDS)[number]

export const COLLECTION_OPS = ['eq', 'neq', 'contains', 'starts_with', 'gt', 'lt'] as const
export type CollectionOp = (typeof COLLECTION_OPS)[number]

export type CollectionMatch = 'all' | 'any'

export type CollectionCondition = {
  field: CollectionField
  /** Rupees for `price` and `compare_at`, whole units for `stock`, grams for `weight`, plain
   *  text otherwise. */
  op: CollectionOp
  value: string
}

export type CollectionRules = {
  match: CollectionMatch
  conditions: CollectionCondition[]
}

/** The product facts a rule reads. The list query supplies them per row. */
export type RuleProduct = {
  title: string
  productType: string | null
  vendor: string | null
  tags: string[]
  /** Cheapest variant, in paise; null when the product has no variants yet. */
  pricePaise: number | null
  /** Cheapest compare-at (MRP) of a shown variant, in paise; null when none has one. */
  compareAtPaise?: number | null | undefined
  /** Units free to sell across the shown variants (audit #153). */
  stock?: number | undefined
  /** Lightest shown variant, in grams; null when none has a weight. */
  weightGrams?: number | null | undefined
  /** Every shown variant's title ("Red / M"). */
  variantTitles?: string[] | undefined
}

export const COLLECTION_SORTS = [
  'manual',
  'title_asc',
  'title_desc',
  'price_asc',
  'price_desc',
  'created_desc',
] as const
export type CollectionSort = (typeof COLLECTION_SORTS)[number]

/** Which operators make sense per field, so the builder never offers a nonsense pair. */
export const COLLECTION_OPS_BY_FIELD: Record<CollectionField, readonly CollectionOp[]> = {
  title: ['eq', 'neq', 'contains', 'starts_with'],
  type: ['eq', 'neq', 'contains'],
  vendor: ['eq', 'neq', 'contains'],
  tag: ['eq', 'neq'],
  price: ['gt', 'lt', 'eq'],
  compare_at: ['gt', 'lt', 'eq'],
  stock: ['gt', 'lt', 'eq'],
  weight: ['gt', 'lt', 'eq'],
  variant_title: ['eq', 'neq', 'contains', 'starts_with'],
}

/** Fields whose value is a number in the builder (the rest are text). */
export const NUMERIC_COLLECTION_FIELDS: readonly CollectionField[] = [
  'price',
  'compare_at',
  'stock',
  'weight',
]

export const emptyCollectionRules = (): CollectionRules => ({ match: 'all', conditions: [] })

function text(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

/** Rupees in the builder, paise in the data: parse leniently, reject nonsense. */
function money(value: string): number | null {
  const n = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

function matchesText(actual: string, op: CollectionOp, expected: string): boolean {
  switch (op) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'contains':
      return expected !== '' && actual.includes(expected)
    case 'starts_with':
      return expected !== '' && actual.startsWith(expected)
    default:
      return false
  }
}

function matchesTags(tags: string[], op: CollectionOp, expected: string): boolean {
  const has = tags.some((t) => text(t) === expected)
  if (op === 'eq') return expected !== '' && has
  if (op === 'neq') return !has
  return false
}

function compare(actual: number | null | undefined, op: CollectionOp, target: number | null) {
  if (target === null || actual === null || actual === undefined) return false
  if (op === 'gt') return actual > target
  if (op === 'lt') return actual < target
  if (op === 'eq') return actual === target
  return false
}

function matchesPrice(pricePaise: number | null, op: CollectionOp, expected: string): boolean {
  return compare(pricePaise, op, money(expected))
}

/** Whole numbers (stock units, grams): parse leniently, reject nonsense. */
function count(value: string): number | null {
  const n = Number(value.replace(/[^\d.-]/g, ''))
  return value.trim() !== '' && Number.isFinite(n) ? Math.round(n) : null
}

/** A variant title rule: "is not" means no variant has it; the rest, any variant does. */
function matchesVariantTitles(titles: string[], op: CollectionOp, expected: string): boolean {
  const all = titles.map(text)
  if (op === 'neq') return !all.includes(expected)
  return all.some((t) => matchesText(t, op, expected))
}

/** One condition against one product. Unknown fields never match. */
export function matchesCollectionCondition(
  p: RuleProduct,
  condition: CollectionCondition,
): boolean {
  const expected = NUMERIC_COLLECTION_FIELDS.includes(condition.field)
    ? condition.value
    : text(condition.value)
  switch (condition.field) {
    case 'title':
      return matchesText(text(p.title), condition.op, expected)
    case 'type':
      return matchesText(text(p.productType), condition.op, expected)
    case 'vendor':
      return matchesText(text(p.vendor), condition.op, expected)
    case 'tag':
      return matchesTags(p.tags, condition.op, expected)
    case 'price':
      return matchesPrice(p.pricePaise, condition.op, expected)
    case 'compare_at':
      return compare(p.compareAtPaise, condition.op, money(expected))
    case 'stock':
      return compare(p.stock ?? 0, condition.op, count(expected))
    case 'weight':
      return compare(p.weightGrams, condition.op, count(expected))
    case 'variant_title':
      return matchesVariantTitles(p.variantTitles ?? [], condition.op, expected)
    default:
      return false
  }
}

/**
 * Whether a product belongs in an automatic collection.
 *
 * No conditions means no members, not every product: an empty rule set is a
 * collection the merchant has not finished writing, and silently sweeping the
 * whole catalogue into it would be worse than showing nothing.
 */
export function evaluateRules(p: RuleProduct, rules: CollectionRules): boolean {
  const conditions = rules.conditions.filter((c) => c.value.trim() !== '' || c.op === 'neq')
  if (conditions.length === 0) return false
  return rules.match === 'any'
    ? conditions.some((c) => matchesCollectionCondition(p, c))
    : conditions.every((c) => matchesCollectionCondition(p, c))
}

/** Members of an automatic collection, in catalogue order. */
export function selectMembers<T extends RuleProduct>(products: T[], rules: CollectionRules): T[] {
  return products.filter((p) => evaluateRules(p, rules))
}
