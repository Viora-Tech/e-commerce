/** SOURCE OF TRUTH: the per-order fee — WHAT a store owes for a month's orders past its plan's
 * included ones / WHY one pure function the monthly bill, the admin estimate and the tests share.
 * Only orders placed inside a paid plan period count, so trial, grace and paused days carry no
 * fee and the plan of each order is the period that covers it (owner, 2026-10-28). Client-safe.
 */
import { PLAN_GST_PERCENT, PLAN_IDS, PLANS, type PlanId } from './plans'

/** One order as the fee sees it: when it was placed and what the buyer paid. */
export type FeeOrder = { id: string; placedAt: Date; totalPaise: number; number?: number }
/** A paid plan period, `[start, end)`. */
export type PaidPeriod = { plan: PlanId; start: Date; end: Date }
export type FeeLine = { plan: PlanId; basisPoints: number; orders: number; feePaise: number }

export type MonthFee = {
  /** Orders inside a paid period. */
  ordersCounted: number
  /** Of those, the ones past the included count that carried a fee. */
  feeOrders: number
  /** One per plan that charged a fee, in plan order. */
  lines: FeeLine[]
  feePaise: number
}

/** Fees under ₹100 (with what was carried in) wait for the next month instead of a bill. */
const USAGE_BILL_MIN_PAISE = 10_000

/** The period covering `at`; after an upgrade two overlap, and the later one wins. */
function periodAt(periods: PaidPeriod[], at: Date): PaidPeriod | null {
  let found: PaidPeriod | null = null
  for (const p of periods) {
    if (p.start <= at && at < p.end && (!found || p.start > found.start)) found = p
  }
  return found
}

/** One order that carried a fee: the order, the plan whose rate applied, and its fee. */
export type FeeRow = FeeOrder & { plan: PlanId; feePaise: number }

/**
 * The orders that carry a fee. Orders are taken in the order they were placed; the k-th
 * counted order carries its plan's fee when k is past that plan's included orders, so an
 * upgrade brings the new included count from that moment on. Each fee is rounded to the paisa.
 */
function walk(orders: FeeOrder[], periods: PaidPeriod[]): { counted: number; rows: FeeRow[] } {
  const sorted = [...orders].sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime())
  const rows: FeeRow[] = []
  let counted = 0
  for (const o of sorted) {
    const period = periodAt(periods, o.placedAt)
    if (!period) continue
    counted++
    const plan = PLANS[period.plan]
    if (counted <= plan.orders || plan.feeBasisPoints === 0) continue
    rows.push({
      ...o,
      plan: plan.id,
      feePaise: Math.round((o.totalPaise * plan.feeBasisPoints) / 10_000),
    })
  }
  return { counted, rows }
}

/** Each order that carried a fee, for the usage bill's CSV. */
export const feeOrderRows = (orders: FeeOrder[], periods: PaidPeriod[]): FeeRow[] =>
  walk(orders, periods).rows

/** The month's fee, one line per plan rate that applied. */
export function monthFee(orders: FeeOrder[], periods: PaidPeriod[]): MonthFee {
  const { counted, rows } = walk(orders, periods)
  const lines = PLAN_IDS.flatMap((id): FeeLine[] => {
    const mine = rows.filter((r) => r.plan === id)
    if (mine.length === 0) return []
    return [
      {
        plan: id,
        basisPoints: PLANS[id].feeBasisPoints,
        orders: mine.length,
        feePaise: mine.reduce((n, r) => n + r.feePaise, 0),
      },
    ]
  })
  return {
    ordersCounted: counted,
    feeOrders: rows.length,
    lines,
    feePaise: lines.reduce((n, l) => n + l.feePaise, 0),
  }
}

/**
 * A fee amount as a sales-store line: the fee plus 18% GST on top, because sales prices include
 * GST (owner, 2026-11-13: fees are "+ GST", like the plan price).
 */
export const withFeeGst = (paise: number): number =>
  paise + Math.round((paise * PLAN_GST_PERCENT) / 100)

/**
 * What a fee bill's own sales order charges: each plan's line and the carried amount, GST on top.
 * A bill without plan lines is charged as one line of `totalPaise`.
 */
export const feeBillChargePaise = (bill: {
  lines: readonly { feePaise: number }[]
  carriedInPaise: number
  totalPaise: number
}): number =>
  bill.lines.length === 0
    ? withFeeGst(bill.totalPaise)
    : bill.lines.reduce((n, l) => n + withFeeGst(l.feePaise), 0) +
      (bill.carriedInPaise > 0 ? withFeeGst(bill.carriedInPaise) : 0)

/** Whether a month's fee plus what was carried in is enough to bill, and the total either way. */
export function billable(
  feePaise: number,
  carriedInPaise: number,
): { bill: boolean; totalPaise: number } {
  const totalPaise = feePaise + carriedInPaise
  return { bill: totalPaise >= USAGE_BILL_MIN_PAISE, totalPaise }
}
