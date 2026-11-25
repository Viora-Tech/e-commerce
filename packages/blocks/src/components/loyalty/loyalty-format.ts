/** SOURCE OF TRUTH: loyalty widget labels — WHAT: a referral offer, a reward's value, a way to earn's title and a day in words, from the widget's data and copy / WHY: the panel, the blocks and the Points page word them the same way */
import { formatInZone } from '@commerce/dates'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import type { LoyaltyGlyph } from './loyalty-icon'
import type {
  LoyaltyOffer,
  LoyaltyPointsName,
  LoyaltyRewardView,
  LoyaltyWayToEarn,
} from './loyalty-types'

/** "10% off", "₹100 off", "100 points". */
export function offerLabel(offer: LoyaltyOffer, names: LoyaltyPointsName): string {
  if (offer.kind === 'percent') return copy.referral.offer.percent(offer.value)
  if (offer.kind === 'fixed') return copy.referral.offer.fixed(formatPaise(offer.value))
  return copy.referral.offer.points(copy.points(offer.value, names))
}

/** What a reward gives, in words ("₹100 off your order"). */
export function rewardValueLabel(r: Pick<LoyaltyRewardView, 'type' | 'value'>): string {
  const v = copy.rewardValue
  switch (r.type) {
    case 'amount_off':
      return v.amount_off(formatPaise(r.value))
    case 'custom_amount_off':
      return v.custom_amount_off(formatPaise(r.value))
    case 'percent_off':
      return v.percent_off(String(Math.round(r.value / 100)))
    case 'free_product':
      return v.free_product
    case 'free_shipping':
      return v.free_shipping
    case 'store_credit':
      return v.store_credit(formatPaise(r.value))
    default:
      return ''
  }
}

/** A way to earn's title: the merchant's, else the platform's or the rule type's wording. */
export function wayTitle(w: Pick<LoyaltyWayToEarn, 'title' | 'type' | 'key' | 'streakDays'>) {
  if (w.title) return w.title
  if (w.type === 'social') return copy.earn.social[w.key] ?? copy.earn.types.social ?? ''
  if (w.type === 'visit_streak' && w.streakDays) return copy.earn.streak(w.streakDays)
  return copy.earn.types[w.type] ?? w.type
}

/** A way to earn's points line ("+50 points", "+1 point for every ₹100 spent"). */
export function wayPoints(w: Pick<LoyaltyWayToEarn, 'type' | 'points'>, names: LoyaltyPointsName) {
  const p = copy.points(w.points, names)
  if (w.type === 'order_spend') return copy.earn.perOrder(p)
  if (w.type === 'daily_visit') return copy.earn.perDay(p)
  return copy.earn.value(p)
}

const WAY_GLYPHS: Record<string, LoyaltyGlyph> = {
  order_spend: 'bag',
  first_order: 'bag',
  signup: 'user',
  newsletter: 'mail',
  birthday: 'cake',
  anniversary: 'calendar',
  daily_visit: 'eye',
  visit_streak: 'flame',
  product_review: 'star',
  google_review: 'chat',
  social: 'share',
}

const REWARD_GLYPHS: Record<string, LoyaltyGlyph> = {
  free_product: 'gift',
  free_shipping: 'truck',
  store_credit: 'wallet',
}

/** The small icon beside a way to earn in the panel's lists. */
export function wayGlyph(type: string): LoyaltyGlyph {
  return WAY_GLYPHS[type] ?? 'star'
}

/** The small icon beside a reward: a tag for money or percent off. */
export function rewardGlyph(type: string): LoyaltyGlyph {
  return REWARD_GLYPHS[type] ?? 'tag'
}

/** "24 Dec 2026" for an ISO time or a `YYYY-MM-DD` day (read at noon UTC, so the day holds). */
export function dayLabel(value: string): string {
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value
  return formatInZone(at, { day: 'numeric', month: 'short', year: 'numeric' })
}
