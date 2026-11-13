/** SOURCE OF TRUTH: plan change proration — WHAT a move to another plan costs today (the new plan
 * for the rest of the period, less the unused days of the old one, plus 18% GST) or that it waits
 * for the period end / WHY the "Move to Pro?" breakdown and `choosePlan`'s bill are one function,
 * so what the owner is shown is what the sales order charges. Pure, client-safe.
 */
import {
  addInterval,
  type BillingInterval,
  PLAN_GST_PERCENT,
  PLANS,
  type PlanId,
  planRank,
} from './plans'

const DAY_MS = 86_400_000

/** The store's plan as `store_plan` keeps it. */
export type CurrentPlan = {
  plan: PlanId
  interval: BillingInterval
  status: 'trialing' | 'active' | 'due' | 'paused' | 'cancelled'
  periodStart: Date | null
  periodEnd: Date | null
}

/** A move that is billed now: what the sales order for it holds. */
export type PlanChargeQuote = {
  kind: 'charge'
  plan: PlanId
  interval: BillingInterval
  /** What the bill pays for: `[periodStart, periodEnd)`. */
  periodStart: Date
  periodEnd: Date
  /** True when the bill covers only the rest of the current period, so `periodEnd` stays put. */
  prorated: boolean
  /** The new plan for the bill's period, before GST. */
  newPlanPaise: number
  /** Days the new plan is charged for when prorated; null for a full period. */
  newPlanDays: number | null
  /** The old plan's unused days, taken off; 0 when nothing is left to credit. */
  creditPlan: PlanId | null
  creditPaise: number
  creditDays: number
  /** `newPlanPaise − creditPaise`, never below 0. */
  netPaise: number
  /** 18% of the net, rounded to the paisa. */
  gstPaise: number
  /** `netPaise + gstPaise`: the plan line of the sales order. */
  planTotalPaise: number
  /** Unpaid per-order fee bills that ride on this bill (their own line, as billed today). */
  feesPaise: number
  /** Pay now. */
  totalPaise: number
  /** When the plan renews at its full price, and that price before GST. */
  renewsAt: Date
  renewalPaise: number
}

export type PlanChangeQuote =
  | PlanChargeQuote
  /** A downgrade on a paid plan: nothing is charged, it starts when the period ends. */
  | { kind: 'scheduled'; plan: PlanId; interval: BillingInterval; startsAt: Date }
  /** Already on this plan and interval with paid time left: nothing to do. */
  | { kind: 'same'; plan: PlanId; interval: BillingInterval }

/** GST on an amount before tax, rounded to the paisa. */
export const gstOn = (paise: number): number => Math.round((paise * PLAN_GST_PERCENT) / 100)

/** `price × days / periodDays`, rounded to the paisa. */
const share = (pricePaise: number, days: number, periodDays: number): number =>
  periodDays <= 0 ? 0 : Math.round((pricePaise * days) / periodDays)

/**
 * Days of `[start, end)` left at `now`. Today counts as unused, so on the first day the whole
 * period is left and on the last day one day is.
 */
function daysLeft(start: Date, end: Date, now: Date): { total: number; left: number } {
  const total = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  const left = Math.ceil((end.getTime() - now.getTime()) / DAY_MS)
  return { total, left: Math.min(total, Math.max(0, left)) }
}

/**
 * Smaller plan, or the same plan from yearly to monthly: the existing rule for a move that
 * waits for the period end instead of being billed now.
 */
const isDowngrade = (from: Pick<CurrentPlan, 'plan' | 'interval'>, to: Target): boolean =>
  planRank(to.plan) < planRank(from.plan) ||
  (to.plan === from.plan && to.interval === 'month' && from.interval === 'year')

type Target = { plan: PlanId; interval: BillingInterval }

/**
 * What moving `current` to `target` costs at `now`.
 *
 * - A downgrade on a paid plan with time left is scheduled for the period end (no refund).
 * - Trialing, due, paused or no paid time left: the new plan's full price for one interval from
 *   now, nothing credited (unchanged from before proration).
 * - An upgrade with paid time left, same interval: the new plan for the rest of the period
 *   (`price × days left / period days`) less the old plan for the same days. The period end and
 *   renewal date stay.
 * - Monthly to yearly: a full year from now at the yearly price, less the old month's unused days.
 * - Yearly to a bigger monthly plan: the rest of the year at twelve times the monthly price,
 *   pro rata, less the old plan's unused days; monthly renewals start when the year would have
 *   ended.
 *
 * GST is 18% of the net, rounded to the paisa. The net is never below 0.
 */
export function quotePlanChange(
  current: CurrentPlan,
  target: Target,
  now: Date,
  feesPaise = 0,
): PlanChangeQuote {
  const paidTimeLeft =
    current.status === 'active' &&
    current.periodStart !== null &&
    current.periodEnd !== null &&
    current.periodEnd > now
  const renewalPaise = PLANS[target.plan].pricePaise[target.interval]

  if (paidTimeLeft && isDowngrade(current, target)) {
    return {
      kind: 'scheduled',
      plan: target.plan,
      interval: target.interval,
      startsAt: current.periodEnd as Date,
    }
  }
  if (paidTimeLeft && target.plan === current.plan && target.interval === current.interval) {
    return { kind: 'same', plan: target.plan, interval: target.interval }
  }

  const charge = (q: {
    periodStart: Date
    periodEnd: Date
    prorated: boolean
    newPlanPaise: number
    newPlanDays: number | null
    creditPaise: number
    creditDays: number
  }): PlanChargeQuote => {
    const netPaise = Math.max(0, q.newPlanPaise - q.creditPaise)
    const gstPaise = gstOn(netPaise)
    const planTotalPaise = netPaise + gstPaise
    return {
      kind: 'charge',
      plan: target.plan,
      interval: target.interval,
      ...q,
      creditPlan: q.creditPaise > 0 ? current.plan : null,
      netPaise,
      gstPaise,
      planTotalPaise,
      feesPaise,
      totalPaise: planTotalPaise + feesPaise,
      renewsAt: q.periodEnd,
      renewalPaise,
    }
  }

  if (!paidTimeLeft) {
    return charge({
      periodStart: now,
      periodEnd: addInterval(now, target.interval),
      prorated: false,
      newPlanPaise: renewalPaise,
      newPlanDays: null,
      creditPaise: 0,
      creditDays: 0,
    })
  }

  const start = current.periodStart as Date
  const end = current.periodEnd as Date
  const { total, left } = daysLeft(start, end, now)
  const creditPaise = share(PLANS[current.plan].pricePaise[current.interval], left, total)

  if (target.interval === 'year' && current.interval === 'month') {
    return charge({
      periodStart: now,
      periodEnd: addInterval(now, 'year'),
      prorated: false,
      newPlanPaise: renewalPaise,
      newPlanDays: null,
      creditPaise,
      creditDays: left,
    })
  }

  // Same interval, or a yearly plan moving to a bigger monthly one: the rest of this period.
  const periodPrice =
    target.interval === current.interval ? renewalPaise : PLANS[target.plan].pricePaise.month * 12
  return charge({
    periodStart: now,
    periodEnd: end,
    prorated: true,
    newPlanPaise: share(periodPrice, left, total),
    newPlanDays: left,
    creditPaise,
    creditDays: left,
  })
}

/**
 * Where a paid bill's time ends. A full bill runs one interval from `start`. A prorated bill (the
 * rest of a period, after an upgrade) keeps its end date so the renewal date does not move; paid
 * only after that date, it gives the days it charged for, from `start`.
 */
export function paidPeriodEnd(
  bill: { prorated: boolean; periodStart: Date; periodEnd: Date; interval: BillingInterval },
  start: Date,
  now: Date,
): Date {
  if (!bill.prorated) return addInterval(start, bill.interval)
  if (now < bill.periodEnd) return bill.periodEnd
  return new Date(start.getTime() + (bill.periodEnd.getTime() - bill.periodStart.getTime()))
}
