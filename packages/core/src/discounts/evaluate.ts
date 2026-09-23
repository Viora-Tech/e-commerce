import type { DiscountAppliesTo, DiscountKind, DiscountMethod, DiscountStatus } from '@commerce/db'

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
  usageLimit: number | null
  usagePerCustomer: number | null
  usedCount: number
  startsAt: Date | null
  endsAt: Date | null
  status: DiscountStatus
}

export type DiscountCartLine = {
  productId: string
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
}

export type DiscountRejection =
  | 'disabled'
  | 'not_started'
  | 'expired'
  | 'usage_limit'
  | 'customer_limit'
  | 'min_subtotal'
  | 'no_eligible_items'

export type DiscountOutcome =
  | {
      ok: true
      discount: DiscountRule
      /** Amount taken off the subtotal (0 for free shipping). */
      amountPaise: number
      freeShipping: boolean
      label: string
    }
  | { ok: false; reason: DiscountRejection; discount: DiscountRule }

/** Round half away from zero, same as payment adjustments, so ₹99.99 at 10% is ₹10.00. */
const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n))

export const subtotalPaise = (lines: DiscountCartLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/** Lines the discount can touch; `all` means the whole cart. */
export function eligibleLines(cart: DiscountCart, d: DiscountRule): DiscountCartLine[] {
  if (d.appliesTo === 'all') return cart.lines
  const ids = new Set(d.appliesToIds)
  if (d.appliesTo === 'products') return cart.lines.filter((l) => ids.has(l.productId))
  return cart.lines.filter((l) => (l.collectionIds ?? []).some((c) => ids.has(c)))
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

  const total = subtotalPaise(cart.lines)
  if (d.minSubtotalPaise !== null && total < d.minSubtotalPaise) return reject('min_subtotal')

  const lines = eligibleLines(cart, d)
  if (lines.length === 0) return reject('no_eligible_items')
  const base = subtotalPaise(lines)

  if (d.method === 'free_shipping') {
    return { ok: true, discount: d, amountPaise: 0, freeShipping: true, label: d.title }
  }
  const raw = d.method === 'percent' ? roundHalfUp((base * d.value) / 10_000) : d.value
  // Never more than the eligible lines are worth, and never more than the cart.
  const amountPaise = Math.max(0, Math.min(raw, base, total))
  return { ok: true, discount: d, amountPaise, freeShipping: false, label: d.title }
}

/**
 * The single best automatic discount for this cart: the largest amount off,
 * free shipping breaking ties only when nothing else applies. Automatic
 * discounts never stack with each other.
 */
export function bestAutomaticDiscount(
  cart: DiscountCart,
  discounts: DiscountRule[],
  ctx: DiscountContext = {},
): Extract<DiscountOutcome, { ok: true }> | null {
  let best: Extract<DiscountOutcome, { ok: true }> | null = null
  for (const d of discounts) {
    if (d.kind !== 'automatic') continue
    const r = evaluateDiscount(cart, d, ctx)
    if (!r.ok) continue
    const value = r.amountPaise + (r.freeShipping ? (cart.shippingPaise ?? 0) : 0)
    const bestValue = best
      ? best.amountPaise + (best.freeShipping ? (cart.shippingPaise ?? 0) : 0)
      : -1
    if (value > bestValue) best = r
  }
  return best
}

/** Totals after a discount and before the payment-method adjustment. */
export function applyDiscount(
  subtotal: number,
  shippingPaise: number,
  outcome: Extract<DiscountOutcome, { ok: true }> | null,
): { discountPaise: number; shippingPaise: number; discountedSubtotalPaise: number } {
  if (!outcome) return { discountPaise: 0, shippingPaise, discountedSubtotalPaise: subtotal }
  const discountPaise = Math.min(outcome.amountPaise, subtotal)
  return {
    discountPaise,
    shippingPaise: outcome.freeShipping ? 0 : shippingPaise,
    discountedSubtotalPaise: subtotal - discountPaise,
  }
}

/** "10% off", "₹200 off", "Free shipping" for admin lists and the checkout summary. */
export function describeDiscountValue(d: Pick<DiscountRule, 'method' | 'value'>): string {
  if (d.method === 'free_shipping') return 'Free shipping'
  if (d.method === 'percent') {
    const pct = d.value / 100
    return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, '')}% off`
  }
  const rupees = d.value / 100
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)} off`
}
