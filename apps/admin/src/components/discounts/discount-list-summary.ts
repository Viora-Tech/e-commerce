import { describeDiscountValue } from '@commerce/core/discounts'
import type { DiscountBxgy, DiscountCombinesWith, DiscountCombo } from '@commerce/db'
import type { discountsContent } from '@/data/discounts'

type Copy = typeof discountsContent

/** The fields of a discount list row the one-line summary and the two extra columns read. */
export type DiscountSummaryInput = {
  type: 'products' | 'order' | 'bxgy' | 'shipping' | 'combo'
  method: 'percent' | 'fixed' | 'free_shipping'
  value: number
  appliesTo: 'all' | 'products' | 'collections'
  appliesToCount: number
  productValues: Record<string, number> | null
  combos: DiscountCombo[] | null
  bxgy: DiscountBxgy | null
  minSubtotalPaise: number | null
  minQuantity: number | null
  shippingStateCount: number
  maxShippingPaise: number | null
  usageLimit: number | null
  usagePerCustomer: number | null
}

const CLASSES = ['products', 'order', 'shipping'] as const

/** What the discount gives and to what: "₹200 off on 18 products", "Buy 2 items, get 1 free". */
function scopePart(
  d: DiscountSummaryInput,
  s: Copy['listSummary'],
  money: (paise: number) => string,
): string {
  if (d.type === 'combo') return s.combos(d.combos?.length ?? 0)
  if (d.type === 'shipping') {
    const where = d.shippingStateCount > 0 ? s.shippingStates(d.shippingStateCount) : s.shippingAll
    return d.maxShippingPaise ? `${where} ${s.rateCap(money(d.maxShippingPaise))}` : where
  }
  if (d.type === 'bxgy' && d.bxgy) {
    const { buys, gets } = d.bxgy
    const how =
      d.method === 'percent' && d.value === 10_000
        ? s.getsFree
        : s.getsOff(describeDiscountValue({ method: d.method, value: d.value }))
    return buys.kind === 'amount'
      ? s.spendGet(money(buys.amountPaise), gets.quantity, how)
      : s.buyGet(buys.quantity, gets.quantity, how)
  }
  const value = describeDiscountValue(d)
  if (d.type === 'order') return s.onOrder(value)
  if (d.appliesTo === 'products') return s.onProducts(value, d.appliesToCount)
  if (d.appliesTo === 'collections') return s.onCollections(value, d.appliesToCount)
  return s.onAllProducts(value)
}

/**
 * One line under a discount's title in the list, as Shopify shows it: what it gives, the
 * minimum, then the limits. "₹200 off on 18 products • Minimum purchase of ₹999 • One use per
 * customer". `money` formats minor units in the member's language.
 */
export function discountListSummary(
  d: DiscountSummaryInput,
  copy: Copy,
  money: (paise: number) => string,
): string {
  const s = copy.listSummary
  const parts = [scopePart(d, s, money)]
  if (d.minSubtotalPaise) parts.push(s.minimum(money(d.minSubtotalPaise)))
  else if (d.minQuantity) parts.push(s.minQuantity(d.minQuantity))
  const perOrder = d.type === 'bxgy' ? d.bxgy?.maxUsesPerOrder : null
  if (perOrder) parts.push(perOrder === 1 ? s.oncePerOrder : s.perOrder(perOrder))
  if (d.usagePerCustomer) {
    parts.push(d.usagePerCustomer === 1 ? s.onePerCustomer : s.perCustomer(d.usagePerCustomer))
  }
  if (d.usageLimit) parts.push(s.totalLimit(d.usageLimit))
  return parts.join(s.separator)
}

/** The Eligibility column: "All customers", "3 segments", "12 customers". */
export function eligibilityLabel(
  d: { customerEligibility: 'all' | 'segments' | 'customers'; eligibleCount: number },
  copy: Copy,
): string {
  if (d.customerEligibility === 'segments') return copy.eligibility.segments(d.eligibleCount)
  if (d.customerEligibility === 'customers') return copy.eligibility.customers(d.eligibleCount)
  return copy.eligibility.all
}

/** The Combinations column: "Product, shipping discounts", or "Doesn't combine". */
export function combinationsLabel(d: { combinesWith: DiscountCombinesWith }, copy: Copy): string {
  const names = CLASSES.filter((c) => d.combinesWith[c]).map((c) => copy.combinations.names[c])
  return names.length > 0 ? copy.combinations.with(names.join(', ')) : copy.combinations.none
}
