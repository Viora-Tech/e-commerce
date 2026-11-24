/** SOURCE OF TRUTH: the loyalty widget's arithmetic — WHAT: points a price earns (rule rate × tier multiplier, as core credits them), which rewards fit a cart, the step to the next tier, a price read off an imported theme's text / WHY: pure and browser-safe so the widget, the blocks and their tests agree with core's `pointsForPaise` and `boostedPoints` */
import type { LoyaltyEarnInfo, LoyaltyRewardView } from './loyalty-types'

/** Paise per ₹100: the order spend rule's unit. */
const PER_100 = 10_000
/** Basis points of a 1x multiplier. */
const ONE_X = 10_000

/** Whole points a price earns: `floor(price × rate / ₹100)`, then the tier multiplier, as core does. */
export function earnPreview(
  pricePaise: number,
  earn: Pick<LoyaltyEarnInfo, 'pointsPer100' | 'multiplierBp'>,
): number {
  if (!Number.isFinite(pricePaise) || pricePaise <= 0 || earn.pointsPer100 <= 0) return 0
  const base = Math.floor((pricePaise * earn.pointsPer100) / PER_100)
  if (base <= 0) return 0
  const bp = earn.multiplierBp > 0 ? earn.multiplierBp : ONE_X
  return Math.floor((base * bp) / ONE_X)
}

/** Points a reward costs before the shopper picks an amount (custom rewards start at their minimum). */
export function rewardCost(
  r: Pick<LoyaltyRewardView, 'type' | 'pointsCost' | 'minPoints'>,
): number {
  return r.type === 'custom_amount_off' ? Math.max(r.pointsCost, r.minPoints ?? 0) : r.pointsCost
}

/**
 * The rewards worth offering in a cart: ones the shopper can take now (no block), whose points
 * they hold, whose minimum order the cart reaches, and, for a free product, whose product is in
 * the cart. A fixed amount off larger than the cart is left out (it would be wasted). Cheapest
 * first.
 */
export function rewardsForCart(
  rewards: readonly LoyaltyRewardView[],
  input: { points: number; subtotalPaise: number; productIds: readonly string[] },
): LoyaltyRewardView[] {
  return rewards
    .filter((r) => {
      if (r.block !== null && r.block !== undefined) return false
      if (r.type === 'store_credit') return false
      if (rewardCost(r) > input.points) return false
      if (r.minOrderPaise !== null && input.subtotalPaise < r.minOrderPaise) return false
      if (r.type === 'free_product') return !!r.productId && input.productIds.includes(r.productId)
      if (r.type === 'amount_off') return r.value <= input.subtotalPaise
      return true
    })
    .sort((a, b) => rewardCost(a) - rewardCost(b))
}

/** How far along to the next tier, 0 to 100 (100 at the top tier). */
export function tierPercent(value: number, nextThreshold: number | null): number {
  if (nextThreshold === null) return 100
  if (nextThreshold <= 0) return 100
  return Math.max(0, Math.min(100, Math.floor((value / nextThreshold) * 100)))
}

/**
 * The price in paise from a theme's price text ("Rs. 1,299.00", "₹ 999", "From ₹2,499"): the
 * last amount, since a sale line shows the old price first. Null when there is none.
 */
export function priceFromText(text: string | null | undefined): number | null {
  if (!text) return null
  const amounts = text.match(/\d[\d,]*(?:\.\d{1,2})?/g)
  if (!amounts || amounts.length === 0) return null
  const last = amounts[amounts.length - 1]?.replace(/,/g, '') ?? ''
  const rupees = Number.parseFloat(last)
  if (!Number.isFinite(rupees) || rupees <= 0) return null
  return Math.round(rupees * 100)
}

/** A member's referral code from the landing URL (`?ref=`), upper-cased; null when there is none. */
export function referralParam(search: string): string | null {
  const raw = new URLSearchParams(search).get('ref')?.trim().toUpperCase() ?? ''
  return /^[A-Z0-9]{6,12}$/.test(raw) ? raw : null
}
