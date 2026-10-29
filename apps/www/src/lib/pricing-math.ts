import { bestPlan, PLAN_GST_PERCENT } from '@commerce/core/billing'
import { PLANS, type Plan } from '@/data/pricing'

export const MIN_ORDERS = 50
export const MAX_ORDERS = 2000
/** The slider moves in 0..SLIDER_STEPS and maps onto orders on a log scale, so 50 to 2,000 stays usable. */
export const SLIDER_STEPS = 1000
/** The cut a typical platform takes, for the calculator's comparison (Shopify Basic in India). */
export const PLATFORM_FEE_RATE = 0.02

const RATIO = MAX_ORDERS / MIN_ORDERS

export function ordersFromSlider(position: number): number {
  const raw = MIN_ORDERS * RATIO ** (position / SLIDER_STEPS)
  const step = raw >= 1000 ? 100 : raw >= 100 ? 10 : 5
  return Math.min(MAX_ORDERS, Math.max(MIN_ORDERS, Math.round(raw / step) * step))
}

export function sliderFromOrders(orders: number): number {
  return Math.round((Math.log(orders / MIN_ORDERS) / Math.log(RATIO)) * SLIDER_STEPS)
}

/** The plan with the lowest monthly total, plan price plus per-order fees (`bestPlan` in billing). */
export function recommendedPlan(orders: number, aov: number): Plan {
  const key = bestPlan(orders, aov)
  const plan = PLANS.find((p) => p.key === key) ?? PLANS[0]
  if (!plan) throw new Error('No plans configured')
  return plan
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatInr(amount: number): string {
  return inr.format(amount)
}

/** What the seller actually pays: plan prices are shown before GST, which is added on the bill. */
export function withGst(amount: number): number {
  return Math.round(amount * (1 + PLAN_GST_PERCENT / 100))
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-IN')
}
