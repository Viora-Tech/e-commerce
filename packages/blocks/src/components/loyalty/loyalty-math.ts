/** SOURCE OF TRUTH: the loyalty widget's arithmetic — WHAT: points a price earns (rule rate × tier multiplier, as core credits them), which rewards fit a cart, the step to the next tier, a price read off an imported theme's text / WHY: pure and browser-safe so the widget, the blocks and their tests agree with core's `pointsForPaise` and `boostedPoints` */
import type { LoyaltyEarnInfo, LoyaltyRewardView, LoyaltyView } from './loyalty-types'

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

/**
 * The earn rate the product line and the cart box count with, read off the full view: the
 * order spend rule's points per ₹100 (0 when the store has none) and the member's tier
 * multiplier (1x for a visitor), so one fetch serves the panel and both placements.
 */
export function earnInfoOf(
  view: Pick<LoyaltyView, 'waysToEarn' | 'tiers' | 'member'>,
): Pick<LoyaltyEarnInfo, 'pointsPer100' | 'multiplierBp'> {
  const rule = view.waysToEarn.find((w) => w.type === 'order_spend')
  const tierId = view.member?.tier.currentId ?? null
  const tier = tierId ? view.tiers.find((t) => t.id === tierId) : undefined
  return { pointsPer100: rule?.points ?? 0, multiplierBp: tier?.multiplierBp ?? ONE_X }
}

/** How far a balance is toward a reward's cost, 0 to 100 (null points: a visitor, 0). */
export function rewardProgress(points: number | null, cost: number): number {
  if (points === null || points <= 0) return 0
  if (cost <= 0) return 100
  return Math.min(100, Math.floor((points / cost) * 100))
}

export type NextReward =
  | { kind: 'none' }
  /** `count` rewards can be claimed now. */
  | { kind: 'available'; count: number }
  /** The cheapest reward still out of reach, and how far along the member is. */
  | { kind: 'next'; reward: LoyaltyRewardView; needed: number; percent: number }

/**
 * The member's "Next reward" card: how many rewards they can claim now (no block, enough
 * points), else the cheapest one still out of reach with the points needed. Rewards closed for
 * another reason (tier, sold out) are left out.
 */
export function nextRewardOf(rewards: readonly LoyaltyRewardView[], points: number): NextReward {
  const open = rewards.filter((r) => r.block === null || r.block === 'points')
  const ready = open.filter((r) => r.block === null && rewardCost(r) <= points)
  if (ready.length > 0) return { kind: 'available', count: ready.length }
  const next = open
    .filter((r) => rewardCost(r) > points)
    .sort((a, b) => rewardCost(a) - rewardCost(b))[0]
  if (!next) return { kind: 'none' }
  const cost = rewardCost(next)
  return {
    kind: 'next',
    reward: next,
    needed: cost - points,
    percent: rewardProgress(points, cost),
  }
}

export type CartRewardRow = {
  reward: LoyaltyRewardView
  /** It can be redeemed and applied to this cart now. */
  ok: boolean
  /** Why not: `points` (not enough), `min_order`, `not_in_cart`, `too_big`, or the server's block. */
  why: string | null
}

/**
 * Every reward the cart box lists: the ones that fit this cart first (cheapest first, as
 * `rewardsForCart`), then the rest greyed with the reason. Store credit is never listed (it pays
 * at checkout on its own).
 */
export function cartRewardRows(
  rewards: readonly LoyaltyRewardView[],
  input: { points: number; subtotalPaise: number; productIds: readonly string[] },
): CartRewardRow[] {
  const fits = rewardsForCart(rewards, input)
  const fitIds = new Set(fits.map((r) => r.id))
  const why = (r: LoyaltyRewardView): string => {
    if (r.block && r.block !== 'points') return r.block
    if (rewardCost(r) > input.points) return 'points'
    if (r.minOrderPaise !== null && input.subtotalPaise < r.minOrderPaise) return 'min_order'
    if (r.type === 'free_product') return 'not_in_cart'
    return 'too_big'
  }
  const rest = rewards
    .filter((r) => r.type !== 'store_credit' && !fitIds.has(r.id))
    .sort((a, b) => rewardCost(a) - rewardCost(b))
    .map((r) => ({ reward: r, ok: false, why: why(r) }))
  return [...fits.map((r) => ({ reward: r, ok: true, why: null })), ...rest]
}

/** What points are worth in paise at the program's point value (each point ₹1 today). */
export function pointsWorthPaise(points: number, view: Pick<LoyaltyView, 'pointPaise'>): number {
  if (points <= 0 || view.pointPaise <= 0) return 0
  return points * view.pointPaise
}
