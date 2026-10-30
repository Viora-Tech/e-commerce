import type {
  DiscountAppliesTo,
  DiscountBxgy,
  DiscountCombinesWith,
  DiscountCombo,
  DiscountEligibility,
  DiscountKind,
  DiscountMethod,
  DiscountStatus,
  DiscountType,
} from '@commerce/db'
import { bxgyAmount } from './bxgy'
import { comboAmount } from './combo'

/** The subset of a `discount` row the evaluator needs; the DB row satisfies it directly. */
export type DiscountRule = {
  id: string
  title: string
  kind: DiscountKind
  code: string | null
  method: DiscountMethod
  value: number
  minSubtotalPaise: number | null
  appliesTo: DiscountAppliesTo
  appliesToIds: string[]
  /**
   * A different amount per product (`{ productId: value }`, same unit as `value`), taken
   * off every unit. Empty or null: the single `value` applies the old way.
   */
  productValues?: Record<string, number> | null | undefined
  /**
   * Shopify's discount type. Rows always have it; older callers may leave it out and get it
   * derived from `method` and `appliesTo` (see `discountType`).
   */
  type?: DiscountType | undefined
  /** Minimum items in the cart (eligible items for a products discount). */
  minQuantity?: number | null | undefined
  bxgy?: DiscountBxgy | null | undefined
  /** Combo deal: Combo 1..N, each a set of items with its own discount. */
  combos?: DiscountCombo[] | null | undefined
  /** Free shipping only to these state codes; empty or missing means everywhere. */
  shippingStates?: string[] | undefined
  /** Free shipping skips rates above this price. */
  maxShippingPaise?: number | null | undefined
  customerEligibility?: DiscountEligibility | undefined
  /** Segment or customer ids, per `customerEligibility`. */
  eligibleIds?: string[] | undefined
  combinesWith?: DiscountCombinesWith | undefined
  usageLimit: number | null
  usagePerCustomer: number | null
  usedCount: number
  startsAt: Date | null
  endsAt: Date | null
  status: DiscountStatus
}

export type DiscountCartLine = {
  productId: string
  /** The exact variant; combo deals made of variants match on it. */
  variantId?: string | undefined
  /** Collections the product belongs to (`collection_product`); `loadDiscountCart` fills it. */
  collectionIds?: string[]
  quantity: number
  unitPricePaise: number
}

export type DiscountCart = {
  lines: DiscountCartLine[]
  shippingPaise?: number
}

export type DiscountContext = {
  now?: Date | undefined
  /** How many times this shopper already used the discount; drives the per-customer cap. */
  customerUses?: number | undefined
  /**
   * Who is buying, once checkout knows: their customer id (null for a new shopper) and the
   * segments they are in. Left out (the cart, before an email) the eligibility check waits.
   */
  customer?: { id: string | null; segmentIds: string[] } | undefined
  /** Delivery state code once an address is known; free shipping limited to states reads it. */
  stateCode?: string | null | undefined
  /** Already taken off by product discounts it combines with; an order discount works on the rest. */
  alreadyOffPaise?: number | undefined
}

export type DiscountRejection =
  | 'disabled'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'customer_limit'
  | 'min_subtotal'
  | 'min_quantity'
  | 'customer_not_eligible'
  | 'region'
  | 'no_eligible_items'

export type DiscountOutcome =
  | {
      ok: true
      discount: DiscountRule
      /** Amount taken off the subtotal (0 for free shipping). */
      amountPaise: number
      freeShipping: boolean
      /** Free shipping only covers rates up to this price; null or missing means any rate. */
      freeShippingMaxPaise?: number | null | undefined
      label: string
      /** When discounts combine: each one that applied. `discount` is then the first of them. */
      parts?: Extract<DiscountOutcome, { ok: true }>[] | undefined
    }
  | { ok: false; reason: DiscountRejection; discount: DiscountRule }

/** Round half away from zero, same as payment adjustments, so ₹99.99 at 10% is ₹10.00. */
const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n))

export const subtotalPaise = (lines: DiscountCartLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/** Lines in a product or collection scope; `all` means the whole cart. */
function linesIn(
  lines: DiscountCartLine[],
  appliesTo: DiscountAppliesTo,
  ids: string[],
): DiscountCartLine[] {
  if (appliesTo === 'all') return lines
  const set = new Set(ids)
  if (appliesTo === 'products') return lines.filter((l) => set.has(l.productId))
  return lines.filter((l) => (l.collectionIds ?? []).some((c) => set.has(c)))
}

/** Lines the discount can touch; `all` means the whole cart. */
export function eligibleLines(cart: DiscountCart, d: DiscountRule): DiscountCartLine[] {
  return linesIn(cart.lines, d.appliesTo, d.appliesToIds)
}

const itemCount = (lines: DiscountCartLine[]): number => lines.reduce((n, l) => n + l.quantity, 0)

/** The rule's type; rows written before types existed read as products, order or shipping. */
export function discountType(d: Pick<DiscountRule, 'type' | 'method' | 'appliesTo'>): DiscountType {
  if (d.type) return d.type
  if (d.method === 'free_shipping') return 'shipping'
  return d.appliesTo === 'all' ? 'order' : 'products'
}

/**
 * The class a discount stacks as: buy X get Y counts as a product discount, like Shopify, and
 * so does a combo deal (it prices sets of products).
 */
export type DiscountClass = keyof DiscountCombinesWith

export function discountClass(
  d: Pick<DiscountRule, 'type' | 'method' | 'appliesTo'>,
): DiscountClass {
  const t = discountType(d)
  return t === 'bxgy' || t === 'combo' ? 'products' : t
}

/** Whether the shopper may use it; unknown shoppers (no email yet) are let through for now. */
function customerAllowed(d: DiscountRule, ctx: DiscountContext): boolean {
  const who = d.customerEligibility ?? 'all'
  if (who === 'all' || !ctx.customer) return true
  const ids = new Set(d.eligibleIds ?? [])
  if (who === 'customers') return ctx.customer.id !== null && ids.has(ctx.customer.id)
  return ctx.customer.segmentIds.some((s) => ids.has(s))
}

/**
 * The per-product amounts when this discount has them, else null. Only product-scoped
 * percent and fixed discounts can carry them; anything else ignores a stray map.
 */
export function perProductValues(
  d: Pick<DiscountRule, 'appliesTo' | 'method' | 'productValues'>,
): Record<string, number> | null {
  if (d.appliesTo !== 'products' || d.method === 'free_shipping') return null
  const map = d.productValues
  return map && Object.keys(map).length > 0 ? map : null
}

/**
 * What one unit gets off: a fixed amount never more than the unit price, a percent in
 * basis points of the unit price rounded like the order-level percent.
 */
function perUnitAmount(method: 'percent' | 'fixed', value: number, unitPricePaise: number): number {
  const raw = method === 'percent' ? roundHalfUp((unitPricePaise * value) / 10_000) : value
  return Math.max(0, Math.min(raw, unitPricePaise))
}

/** Per-product discount for the eligible lines: each unit's amount times its quantity. */
function perItemAmount(
  lines: DiscountCartLine[],
  method: 'percent' | 'fixed',
  values: Record<string, number>,
): number {
  return lines.reduce((sum, l) => {
    const value = values[l.productId]
    if (value === undefined || value <= 0) return sum
    return sum + perUnitAmount(method, value, l.unitPricePaise) * l.quantity
  }, 0)
}

/** Codes are stored upper-cased without surrounding whitespace so lookups are exact. */
export const normaliseCode = (code: string): string => code.trim().toUpperCase()

/**
 * Decide whether a discount applies to a cart and what it is worth. Pure:
 * usage numbers and the clock come in through the arguments, so the same
 * function serves the checkout preview, the order transaction and tests.
 */
export function evaluateDiscount(
  cart: DiscountCart,
  d: DiscountRule,
  ctx: DiscountContext = {},
): DiscountOutcome {
  const now = ctx.now ?? new Date()
  const reject = (reason: DiscountRejection): DiscountOutcome => ({
    ok: false,
    reason,
    discount: d,
  })

  if (d.status !== 'active') return reject('disabled')
  if (d.startsAt && now < d.startsAt) return reject('not_started')
  if (d.endsAt && now > d.endsAt) return reject('expired')
  if (d.usageLimit !== null && d.usedCount >= d.usageLimit) return reject('usage_limit')
  if (d.usagePerCustomer !== null && (ctx.customerUses ?? 0) >= d.usagePerCustomer) {
    return reject('customer_limit')
  }
  if (!customerAllowed(d, ctx)) return reject('customer_not_eligible')

  const type = discountType(d)
  const total = subtotalPaise(cart.lines)
  if (d.minSubtotalPaise !== null && total < d.minSubtotalPaise) return reject('min_subtotal')

  if (type === 'bxgy') {
    const raw =
      d.bxgy && d.method !== 'free_shipping' ? bxgyAmount(cart.lines, d.method, d.value, d.bxgy) : 0
    const amountPaise = Math.min(raw, total)
    if (amountPaise <= 0) return reject('no_eligible_items')
    return { ok: true, discount: d, amountPaise, freeShipping: false, label: d.title }
  }

  if (type === 'combo') {
    const amountPaise = Math.min(comboAmount(cart.lines, d.combos ?? []).amountPaise, total)
    if (amountPaise <= 0) return reject('no_eligible_items')
    return { ok: true, discount: d, amountPaise, freeShipping: false, label: d.title }
  }

  // Order and shipping discounts cover the whole cart (`appliesTo` is `all` for them).
  const lines = eligibleLines(cart, d)
  if (d.minQuantity != null && itemCount(lines) < d.minQuantity) return reject('min_quantity')
  if (lines.length === 0) return reject('no_eligible_items')

  if (type === 'shipping' || d.method === 'free_shipping') {
    const states = d.shippingStates ?? []
    if (states.length > 0 && ctx.stateCode && !states.includes(ctx.stateCode)) {
      return reject('region')
    }
    return {
      ok: true,
      discount: d,
      amountPaise: 0,
      freeShipping: true,
      freeShippingMaxPaise: d.maxShippingPaise ?? null,
      label: d.title,
    }
  }
  // An order discount stacked after product discounts works on what they left.
  const alreadyOff = type === 'order' ? (ctx.alreadyOffPaise ?? 0) : 0
  const base = Math.max(0, subtotalPaise(lines) - alreadyOff)
  const perItem = perProductValues(d)
  const raw = perItem
    ? perItemAmount(lines, d.method, perItem)
    : d.method === 'percent'
      ? roundHalfUp((base * d.value) / 10_000)
      : d.value
  // A per-product discount whose cart products all lack an amount gives nothing: not applicable.
  if (perItem && raw === 0) return reject('no_eligible_items')
  // Never more than the eligible lines are worth, and never more than the cart.
  const amountPaise = Math.max(0, Math.min(raw, base, total))
  return { ok: true, discount: d, amountPaise, freeShipping: false, label: d.title }
}

/** Totals after a discount and before the payment-method adjustment. */
export function applyDiscount(
  subtotal: number,
  shippingPaise: number,
  outcome: Extract<DiscountOutcome, { ok: true }> | null,
): { discountPaise: number; shippingPaise: number; discountedSubtotalPaise: number } {
  if (!outcome) return { discountPaise: 0, shippingPaise, discountedSubtotalPaise: subtotal }
  const discountPaise = Math.min(outcome.amountPaise, subtotal)
  const cap = outcome.freeShippingMaxPaise ?? null
  // "Exclude shipping rates over a certain amount": a dearer rate is charged in full.
  const waived = outcome.freeShipping && (cap === null || shippingPaise <= cap)
  return {
    discountPaise,
    shippingPaise: waived ? 0 : shippingPaise,
    discountedSubtotalPaise: subtotal - discountPaise,
  }
}

const percentText = (bp: number): string => {
  const pct = bp / 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, '')}%`
}

const rupeeText = (paise: number): string => {
  const rupees = paise / 100
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`
}

/**
 * "10% off", "₹200 off", "Free shipping" for admin lists and the checkout summary. A
 * per-product discount reads "₹200 to ₹300 off each item" (or one amount when all match).
 */
export function describeDiscountValue(
  d: Pick<DiscountRule, 'method' | 'value'> &
    Partial<Pick<DiscountRule, 'appliesTo' | 'productValues' | 'type' | 'combos'>>,
): string {
  if (d.type === 'combo') {
    const n = d.combos?.length ?? 0
    return n === 1 ? '1 combo' : `${n} combos`
  }
  if (d.method === 'free_shipping') return 'Free shipping'
  if (d.type === 'bxgy') {
    const off =
      d.method === 'percent' && d.value === 10_000
        ? 'free'
        : `${(d.method === 'percent' ? percentText : rupeeText)(d.value)} off`
    return `Buy X get Y (${off})`
  }
  const text = d.method === 'percent' ? percentText : rupeeText
  const perItem = perProductValues({
    appliesTo: d.appliesTo ?? 'all',
    method: d.method,
    productValues: d.productValues,
  })
  if (!perItem) return `${text(d.value)} off`
  const values = Object.values(perItem)
  const low = Math.min(...values)
  const high = Math.max(...values)
  const amount = low === high ? text(low) : `${text(low)} to ${text(high)}`
  return `${amount} off each item`
}
