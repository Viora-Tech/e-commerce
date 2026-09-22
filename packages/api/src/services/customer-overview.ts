/**
 * Pure maths behind the "Customer Overview" card (frame 5:3062): four daily
 * series over one week. No database and no clock of its own, so the numbers can
 * be tested directly. Days are Indian Standard Time, matching the dashboard.
 */
import { bucketByDay, conversionRate, istIsoDate } from './analytics-buckets'

export type OverviewOrder = {
  at: Date
  /** Null for a guest checkout; every guest order counts as its own customer. */
  customerId: string | null
  /** True when the buyer has ordered more than once in the store's history. */
  repeat: boolean
}

export type CustomerOverviewSeries = {
  /** ISO dates (YYYY-MM-DD) in IST, oldest first. */
  days: string[]
  /** Distinct customers who ordered that day. */
  activeCustomers: number[]
  /** Of those, the ones who had ordered before. */
  repeatCustomers: number[]
  /** Unique storefront visitors that day. */
  shopVisitors: number[]
  /** Orders per visitor that day, as a percentage with one decimal. */
  conversionRate: number[]
}

/** Distinct buyers per day; guests never merge because each order gets its own key. */
function distinctPerDay(
  orders: OverviewOrder[],
  days: string[],
  keep: (order: OverviewOrder) => boolean,
): number[] {
  const index = new Map(days.map((d, i) => [d, i]))
  const seen = days.map(() => new Set<string>())
  orders.forEach((o, position) => {
    if (!keep(o)) return
    const i = index.get(istIsoDate(o.at))
    if (i === undefined) return
    seen[i]?.add(o.customerId ?? `guest:${position}`)
  })
  return seen.map((s) => s.size)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** The four plotted series for one week. */
export function buildCustomerOverviewSeries(input: {
  days: string[]
  orders: OverviewOrder[]
  /** Unique visitors per day, aligned with `days`; missing entries read zero. */
  visitors: number[]
}): CustomerOverviewSeries {
  const { days, orders, visitors } = input
  const ordersPerDay = bucketByDay(
    orders.map((o) => ({ at: o.at })),
    days,
  )
  const shopVisitors = days.map((_, i) => visitors[i] ?? 0)
  return {
    days,
    activeCustomers: distinctPerDay(orders, days, () => true),
    repeatCustomers: distinctPerDay(orders, days, (o) => o.repeat),
    shopVisitors,
    conversionRate: days.map((_, i) =>
      round1(conversionRate(ordersPerDay[i] ?? 0, shopVisitors[i] ?? 0) * 100),
    ),
  }
}
