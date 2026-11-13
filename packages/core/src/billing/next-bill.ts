/** SOURCE OF TRUTH: next bill and pace — WHAT the Plan & billing page's "Next bill" adds up to,
 * the month's order pace, and when a bigger plan would cost less / WHY the projection, the usage
 * nudge and Change plan's "≈ ₹ fees at your pace" use the existing prices, per-order fee and
 * paid-app prices only (`PLANS`, `monthlyCost`, `APP_PRICING`); no pricing rule lives here. Pure,
 * client-safe.
 */
import { APP_PRICING } from './apps'
import { monthlyCost } from './cost-estimate'
import { type BillingInterval, PLAN_IDS, PLANS, type PlanId, planRank } from './plans'
import { gstOn } from './proration'

/** This month's orders and where they are heading if the month goes on like this. */
export type MonthPace = {
  /** Orders so far this month (the "182 of 200" count). */
  orders: number
  /** What those orders took, in paise. */
  salesPaise: number
  /** `orders × days in month / days so far`, rounded. */
  projectedOrders: number
  /** Average order, in paise; null before the first order. */
  avgOrderPaise: number | null
}

/** The pace for an IST day key (`YYYY-MM-DD`): today counts as a day so far. */
export function monthPace(orders: number, salesPaise: number, dayKey: string): MonthPace {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    orders,
    salesPaise,
    projectedOrders: d > 0 ? Math.round((orders * daysInMonth) / d) : orders,
    avgOrderPaise: orders > 0 ? Math.round(salesPaise / orders) : null,
  }
}

/** A plan's month at this pace: price plus the per-order fee, in whole rupees (`monthlyCost`). */
const costAtPace = (plan: PlanId, pace: MonthPace) =>
  monthlyCost(plan, pace.projectedOrders, (pace.avgOrderPaise ?? 0) / 100)

/** "≈ ₹3,950 fees at your pace": the per-order fee this plan would charge this month, in rupees. */
export const feesAtPace = (plan: PlanId, pace: MonthPace): number => costAtPace(plan, pace).feeInr

/** Above this many orders a month a plan costs no more than the one below it. */
const BREAK_EVEN_CAP = 20_000

/**
 * "Best value past ~400 orders": the fewest orders a month at which `plan` costs no more than
 * the plan below it, at this average order. Null for Starter, or when it never does below 20,000.
 */
export function breakEvenOrders(plan: PlanId, avgOrderPaise: number | null): number | null {
  const below = PLAN_IDS[planRank(plan) - 1]
  if (!below || !avgOrderPaise) return null
  const avg = avgOrderPaise / 100
  for (let n = PLANS[below].orders; n <= BREAK_EVEN_CAP; n++) {
    if (monthlyCost(plan, n, avg).totalInr <= monthlyCost(below, n, avg).totalInr) return n
  }
  return null
}

/** A bigger plan that costs less at this pace, and about how much less a month. */
export type UpgradeNudge = { plan: PlanId; savingInr: number }

/** Savings under this (in rupees) are not worth a nudge. */
const NUDGE_MIN_INR = 100

/**
 * The bigger plan with the lowest month at this pace, when it beats the current plan by at least
 * ₹100. The saving is rounded to the nearest ₹100 ("about ₹1,100"). Null otherwise, and before
 * the first order (no average to work from).
 */
export function upgradeNudge(plan: PlanId, pace: MonthPace): UpgradeNudge | null {
  if (pace.avgOrderPaise === null) return null
  const now = costAtPace(plan, pace).totalInr
  let best: UpgradeNudge | null = null
  for (const p of PLAN_IDS) {
    if (planRank(p) <= planRank(plan)) continue
    const saving = now - costAtPace(p, pace).totalInr
    if (saving >= NUDGE_MIN_INR && (!best || saving > best.savingInr))
      best = { plan: p, savingInr: saving }
  }
  return best && { plan: best.plan, savingInr: Math.round(best.savingInr / 100) * 100 }
}

/** Every amount on the "Next bill" card, in paise. */
export type NextBill = {
  plan: PlanId
  interval: BillingInterval
  /** The plan's price before GST, for the period starting `dueAt`. */
  planPaise: number
  /** This month's per-order fees so far plus what earlier months carried in. */
  feesPaise: number
  feesMonth: string
  /** Paid apps that renew (not included in `plan`), with their monthly prices. */
  apps: { pluginId: string; pricePaise: number }[]
  appsPaise: number
  /** 18% of plan + fees + apps, rounded to the paisa. */
  gstPaise: number
  totalPaise: number
  dueAt: Date
}

/**
 * What the next bill adds up to: the plan at its renewal (a scheduled downgrade counts), this
 * month's per-order fees so far, and the bought apps that renew and that the renewing plan does
 * not include, plus 18% GST on the lot. Null with nothing to renew (no paid time and no trial).
 */
export function projectNextBill(input: {
  plan: PlanId
  nextPlan: PlanId | null
  interval: BillingInterval
  periodEnd: Date | null
  trialEndsAt: Date | null
  fees: { feePaise: number; carriedInPaise: number; month: string }
  /** App ids bought on top of the plan that renew. */
  renewingApps: string[]
}): NextBill | null {
  const dueAt = input.periodEnd ?? input.trialEndsAt
  if (!dueAt) return null
  const plan = input.nextPlan ?? input.plan
  const planPaise = PLANS[plan].pricePaise[input.interval]
  const feesPaise = input.fees.feePaise + input.fees.carriedInPaise
  const apps = input.renewingApps.flatMap((id) => {
    const price = APP_PRICING[id]
    if (!price || planRank(plan) >= planRank(price.includedFrom)) return []
    return [{ pluginId: id, pricePaise: price.pricePaise }]
  })
  const appsPaise = apps.reduce((n, a) => n + a.pricePaise, 0)
  const gstPaise = gstOn(planPaise + feesPaise + appsPaise)
  return {
    plan,
    interval: input.interval,
    planPaise,
    feesPaise,
    feesMonth: input.fees.month,
    apps,
    appsPaise,
    gstPaise,
    totalPaise: planPaise + feesPaise + appsPaise + gstPaise,
    dueAt,
  }
}
