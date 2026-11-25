/** SOURCE OF TRUTH: the New reward page's form — WHAT: the reward form (typed amounts as text), made from a saved reward or a type's starting values, the customer title with its `{amount}` placeholder filled and recovered, and the input `loyalty.rewards.save` takes / WHY: the storefront shows the saved title as it is, so the placeholder is filled on save and put back when the reward is opened again */
import type { RewardRow } from '@commerce/core'
import type { LoyaltyRewardType, RewardInput } from '@commerce/core/loyalty'

export const AMOUNT = '{amount}'

export type RewardForm = {
  type: LoyaltyRewardType
  /** The title customers see, `{amount}` standing for the value. */
  title: string
  description: string
  pointsCost: number
  /** Rupees (amount off, per step, store credit) or percent, as typed. */
  value: string
  minPoints: string
  maxPoints: string
  productId: string | null
  productTitle: string
  minOrder: string
  minTierId: string | null
  usageLimit: string
  oncePerCustomer: boolean
  /** Days a code works; '' never runs out. */
  codeDays: string
  active: boolean
  position: number
}

/** Titles each type starts with (English; the page passes the member's language). */
export type RewardTitles = Record<LoyaltyRewardType, string>

const START: Record<LoyaltyRewardType, { pointsCost: number; value: string }> = {
  amount_off: { pointsCost: 100, value: '100' },
  custom_amount_off: { pointsCost: 1, value: '1' },
  percent_off: { pointsCost: 200, value: '10' },
  free_product: { pointsCost: 500, value: '' },
  free_shipping: { pointsCost: 100, value: '' },
  store_credit: { pointsCost: 100, value: '100' },
}

const num = (raw: string): number | null => {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** "₹50" for amounts, "10%" for a percent, the product's title for a free product, else ''. */
export function amountText(
  f: Pick<RewardForm, 'type' | 'value' | 'productTitle'>,
  money: (paise: number) => string,
): string {
  const n = num(f.value) ?? 0
  switch (f.type) {
    case 'amount_off':
    case 'custom_amount_off':
    case 'store_credit':
      return money(Math.round(n * 100))
    case 'percent_off':
      return `${Math.round(n * 100) / 100}%`
    case 'free_product':
      return f.productTitle
    default:
      return ''
  }
}

/** The title with `{amount}` filled in. */
export const fillTitle = (template: string, amount: string) =>
  template.split(AMOUNT).join(amount).replace(/\s+/g, ' ').trim()

/** A saved title with its amount put back as `{amount}` (the first time it appears). */
export function titleTemplate(title: string, amount: string): string {
  if (amount === '' || !title.includes(amount)) return title
  return title.replace(amount, AMOUNT)
}

export function newRewardForm(
  type: LoyaltyRewardType,
  titles: RewardTitles,
  position: number,
): RewardForm {
  return {
    type,
    title: titles[type],
    description: '',
    pointsCost: START[type].pointsCost,
    value: START[type].value,
    minPoints: '',
    maxPoints: '',
    productId: null,
    productTitle: '',
    minOrder: '',
    minTierId: null,
    usageLimit: '',
    oncePerCustomer: false,
    codeDays: '90',
    active: true,
    position,
  }
}

/** A type change keeps what the member wrote, and resets the value and title to the type's own. */
export function switchType(
  f: RewardForm,
  type: LoyaltyRewardType,
  titles: RewardTitles,
): RewardForm {
  const keepTitle = f.title !== titles[f.type]
  return {
    ...f,
    type,
    title: keepTitle ? f.title : titles[type],
    value: START[type].value,
    pointsCost:
      f.type === 'custom_amount_off' || type === 'custom_amount_off'
        ? START[type].pointsCost
        : f.pointsCost,
  }
}

export function rewardFormOf(
  r: RewardRow,
  productTitle: string,
  money: (paise: number) => string,
): RewardForm {
  const value =
    r.type === 'percent_off'
      ? String(r.value / 100)
      : r.type === 'free_product' || r.type === 'free_shipping'
        ? ''
        : String(r.value / 100)
  const base = { type: r.type, value, productTitle }
  return {
    type: r.type,
    title: titleTemplate(r.title, amountText(base, money)),
    description: r.description ?? '',
    pointsCost: r.pointsCost,
    value,
    minPoints: r.minPoints === null ? '' : String(r.minPoints),
    maxPoints: r.maxPoints === null ? '' : String(r.maxPoints),
    productId: r.productId,
    productTitle,
    minOrder: r.minOrderPaise === null ? '' : String(r.minOrderPaise / 100),
    minTierId: r.minTierId,
    usageLimit: r.usageLimit === null ? '' : String(r.usageLimit),
    oncePerCustomer: r.oncePerCustomer,
    codeDays: r.codeDays === null ? '' : String(r.codeDays),
    active: r.active,
    position: r.position,
  }
}

const whole = (raw: string): number | null => {
  const n = num(raw)
  return n === null ? null : Math.max(0, Math.round(n))
}

/** What `loyalty.rewards.save` takes. */
export function rewardInputOf(f: RewardForm, money: (paise: number) => string): RewardInput {
  const n = num(f.value) ?? 0
  const value = f.type === 'free_product' || f.type === 'free_shipping' ? 0 : Math.round(n * 100)
  const minOrder = num(f.minOrder)
  const custom = f.type === 'custom_amount_off'
  return {
    type: f.type,
    title: fillTitle(f.title, amountText(f, money)),
    description: f.description.trim() === '' ? null : f.description.trim(),
    pointsCost: f.pointsCost,
    value,
    minPoints: custom ? whole(f.minPoints) || null : null,
    maxPoints: custom ? whole(f.maxPoints) || null : null,
    productId: f.type === 'free_product' ? f.productId : null,
    variantId: null,
    minOrderPaise: minOrder === null || minOrder <= 0 ? null : Math.round(minOrder * 100),
    minTierId: f.minTierId,
    usageLimit: whole(f.usageLimit) || null,
    oncePerCustomer: f.oncePerCustomer,
    codeDays: f.type === 'store_credit' ? null : whole(f.codeDays) || null,
    active: f.active,
    position: f.position,
  }
}

/** Whether a store credit reward or one with a code (every other type). */
export const givesCode = (type: LoyaltyRewardType) => type !== 'store_credit'

/** The form's first problem, as a key of the page's error copy; null when it can be saved. */
export function rewardProblem(
  f: RewardForm,
): 'title' | 'value' | 'percent' | 'product' | 'points' | 'range' | null {
  if (f.title.trim() === '') return 'title'
  const n = num(f.value)
  if (['amount_off', 'custom_amount_off', 'store_credit'].includes(f.type) && !(n && n > 0)) {
    return 'value'
  }
  if (f.type === 'percent_off' && !(n && n > 0 && n <= 100)) return 'percent'
  if (f.type === 'free_product' && !f.productId) return 'product'
  if (f.type === 'custom_amount_off' && f.pointsCost <= 0) return 'points'
  const lo = whole(f.minPoints)
  const hi = whole(f.maxPoints)
  if (f.type === 'custom_amount_off' && lo && hi && lo > hi) return 'range'
  return null
}
