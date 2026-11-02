/**
 * Customer segments: saved filters over the customer list.
 *
 * The rule shape mirrors the discount conditions idea (a match mode plus a list
 * of field/op/value rows) so the admin can reuse one condition builder, but the
 * fields are customer facts rather than cart facts.
 */

export const SEGMENT_FIELDS = [
  'spend',
  'orders',
  'state',
  'tag',
  'last_order_days',
  'marketing',
  'business',
  // Added for #1020 (owner, 3 Nov 2026): filters a D2C store actually segments by.
  'aov',
  'city',
  'customer_days',
  'first_order_days',
  'product',
  'cod_orders',
  'rto_orders',
  'abandoned_cart',
] as const
export type SegmentField = (typeof SEGMENT_FIELDS)[number]

/** `between` takes "min,max" (both inclusive) for number fields. */
export const SEGMENT_OPS = ['gte', 'lte', 'eq', 'neq', 'contains', 'between'] as const
export type SegmentOp = (typeof SEGMENT_OPS)[number]

export type SegmentMatch = 'all' | 'any'

export type SegmentCondition = {
  field: SegmentField
  op: SegmentOp
  /**
   * Paise for spend, a count for orders, days for last_order_days, 'true'/'false' for
   * marketing and business, text otherwise.
   */
  value: string
}

export type SegmentRules = {
  match: SegmentMatch
  conditions: SegmentCondition[]
}

/** The customer facts a rule can read; the list query supplies them per row. */
export type SegmentCustomer = {
  spentPaise: number
  orderCount: number
  stateCode: string | null
  tags: string[]
  lastOrderAt: Date | string | null
  acceptsMarketing: boolean
  /** Saved a GSTIN, i.e. buys as a business (B2B). */
  hasGstin: boolean
  /**
   * Facts the newer filters read, loaded only when a rule uses one (`segmentExtras`). Absent
   * means unknown, and an unknown fact never matches.
   */
  city?: string | null | undefined
  createdAt?: Date | string | null | undefined
  firstOrderAt?: Date | string | null | undefined
  productIds?: string[] | undefined
  codOrders?: number | undefined
  rtoOrders?: number | undefined
  abandonedCart?: boolean | undefined
}

/** Fields whose facts are not on the customer list row; `segmentExtras` loads them. */
export const EXTRA_SEGMENT_FIELDS: ReadonlySet<SegmentField> = new Set<SegmentField>([
  'city',
  'customer_days',
  'first_order_days',
  'product',
  'cod_orders',
  'rto_orders',
  'abandoned_cart',
])

/** Whether any rule reads a fact the plain customer list does not carry. */
export function needsSegmentExtras(rules: SegmentRules | readonly SegmentRules[]): boolean {
  const all: readonly SegmentRules[] = Array.isArray(rules)
    ? (rules as readonly SegmentRules[])
    : [rules as SegmentRules]
  return all.some((r) => (r.conditions ?? []).some((c) => EXTRA_SEGMENT_FIELDS.has(c.field)))
}

/** Which operators make sense per field, so the builder never offers a nonsense pair. */
export const OPS_BY_FIELD: Record<SegmentField, readonly SegmentOp[]> = {
  spend: ['gte', 'lte', 'between'],
  orders: ['gte', 'lte', 'eq', 'between'],
  state: ['eq', 'neq'],
  tag: ['contains', 'eq', 'neq'],
  last_order_days: ['lte', 'gte', 'between'],
  marketing: ['eq'],
  business: ['eq'],
  aov: ['gte', 'lte', 'between'],
  city: ['eq', 'neq', 'contains'],
  customer_days: ['lte', 'gte', 'between'],
  first_order_days: ['lte', 'gte', 'between'],
  product: ['eq', 'neq'],
  cod_orders: ['gte', 'lte', 'eq', 'between'],
  rto_orders: ['gte', 'lte', 'eq', 'between'],
  abandoned_cart: ['eq'],
}

const DAY_MS = 86_400_000

function toNumber(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function daysSince(when: Date | string | null, now: Date): number | null {
  if (!when) return null
  const then = when instanceof Date ? when : new Date(when)
  if (Number.isNaN(then.getTime())) return null
  return (now.getTime() - then.getTime()) / DAY_MS
}

/** "min,max" for `between`; a missing side is open-ended. */
function bounds(value: string): [number, number] {
  const [lo, hi] = value.split(',').map((v) => Number.parseFloat(v))
  return [
    Number.isFinite(lo) ? (lo as number) : -Infinity,
    Number.isFinite(hi) ? (hi as number) : Infinity,
  ]
}

function compareRange(actual: number, op: SegmentOp, value: string): boolean {
  if (op !== 'between') return compareNumber(actual, op, toNumber(value))
  const [lo, hi] = bounds(value)
  return actual >= lo && actual <= hi
}

function compareNumber(actual: number, op: SegmentOp, expected: number): boolean {
  if (op === 'gte') return actual >= expected
  if (op === 'lte') return actual <= expected
  if (op === 'eq') return actual === expected
  if (op === 'neq') return actual !== expected
  return false
}

function compareText(actual: string | null, op: SegmentOp, expected: string): boolean {
  const a = (actual ?? '').trim().toLowerCase()
  const b = expected.trim().toLowerCase()
  if (op === 'eq') return a === b
  if (op === 'neq') return a !== b
  if (op === 'contains') return a.includes(b)
  return false
}

function compareTags(tags: string[], op: SegmentOp, expected: string): boolean {
  const wanted = expected.trim().toLowerCase()
  if (!wanted) return op === 'neq'
  const has = tags.some((t) => t.trim().toLowerCase() === wanted)
  if (op === 'neq') return !has
  return has
}

function compareFlag(actual: boolean, op: SegmentOp, value: string): boolean {
  const wants = value === 'true'
  return op === 'eq' ? actual === wants : actual !== wants
}

/** True when a single condition holds. Unknown or unusable values never match. */
export function matchesCondition(
  customer: SegmentCustomer,
  condition: SegmentCondition,
  now: Date,
): boolean {
  const { field, op, value } = condition
  if (field === 'spend') return compareRange(customer.spentPaise, op, value)
  if (field === 'orders') return compareRange(customer.orderCount, op, value)
  if (field === 'state') return compareText(customer.stateCode, op, value)
  if (field === 'tag') return compareTags(customer.tags, op, value)
  if (field === 'marketing') return compareFlag(customer.acceptsMarketing, op, value)
  if (field === 'business') return compareFlag(customer.hasGstin, op, value)
  if (field === 'aov') {
    // Average order value in paise; nobody without an order has one.
    if (customer.orderCount <= 0) return false
    return compareRange(Math.round(customer.spentPaise / customer.orderCount), op, value)
  }
  if (field === 'city') {
    return customer.city === undefined ? false : compareText(customer.city, op, value)
  }
  if (field === 'product') {
    if (!customer.productIds) return false
    const has = customer.productIds.includes(value.trim())
    return op === 'neq' ? !has : has
  }
  if (field === 'cod_orders') {
    return customer.codOrders === undefined ? false : compareRange(customer.codOrders, op, value)
  }
  if (field === 'rto_orders') {
    return customer.rtoOrders === undefined ? false : compareRange(customer.rtoOrders, op, value)
  }
  if (field === 'abandoned_cart') {
    return customer.abandonedCart === undefined
      ? false
      : compareFlag(customer.abandonedCart, op, value)
  }
  const when =
    field === 'customer_days'
      ? customer.createdAt
      : field === 'first_order_days'
        ? customer.firstOrderAt
        : customer.lastOrderAt
  const days = daysSince(when ?? null, now)
  if (days === null) return false
  return compareRange(days, op, value)
}

/**
 * True when the customer belongs to the segment. An empty rule set matches
 * everyone, which is what an unsaved builder should preview.
 */
export function evaluateSegment(
  customer: SegmentCustomer,
  rules: SegmentRules,
  now: Date = new Date(),
): boolean {
  const conditions = rules.conditions ?? []
  if (conditions.length === 0) return true
  if (rules.match === 'any') return conditions.some((c) => matchesCondition(customer, c, now))
  return conditions.every((c) => matchesCondition(customer, c, now))
}

/** Yes/no fields, whose value is 'true' or 'false'. */
export function isFlagField(field: SegmentField): boolean {
  return field === 'marketing' || field === 'business' || field === 'abandoned_cart'
}

/** Default row for a freshly added condition, so the builder always has a valid op. */
export function defaultCondition(field: SegmentField = 'spend'): SegmentCondition {
  return { field, op: OPS_BY_FIELD[field][0] ?? 'eq', value: isFlagField(field) ? 'true' : '' }
}
