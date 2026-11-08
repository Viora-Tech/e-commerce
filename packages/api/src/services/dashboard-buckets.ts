/** Pure day / hour / status bucketing behind the home dashboard's series and charts. Split out of dashboard.service.ts. */
import { dayKey, wallClock, startOfDay as zoneStartOfDay } from '@commerce/dates'
import type { DashboardSeries } from './dashboard.service'

const DAY_MS = 86_400_000

/** Midnight `daysAgo` days before `now` in Indian Standard Time (fixed +05:30, no DST). */
export function startOfDay(now: Date, daysAgo: number): Date {
  return zoneStartOfDay(now, undefined, -daysAgo)
}

/** ISO date of an instant, read in IST. */
export function isoDate(d: Date): string {
  return dayKey(d)
}

/** Day index of `at` counted from `from` (IST midnight), or -1 when outside `days`. */
export function dayIndex(at: Date, from: Date, days: number): number {
  const idx = Math.floor((at.getTime() - from.getTime()) / DAY_MS)
  return idx >= 0 && idx < days ? idx : -1
}

export function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

/** Hour of the day (0-23) that `at` falls in, read in IST. */
export function istHour(at: Date): number {
  return wallClock(at).getUTCHours()
}

/** Day of the week (0 = Sunday) that `at` falls on, read in IST. */
export function istWeekday(at: Date): number {
  return wallClock(at).getUTCDay()
}

/** Order counts per hour (0-23, IST) for rows placed in `[from, to)`. */
export function hourlyCounts(rows: { placedAt: Date }[], from: Date, to: Date): number[] {
  const out = zeros(24)
  for (const r of rows) {
    if (r.placedAt < from || r.placedAt >= to) continue
    const h = istHour(r.placedAt)
    out[h] = (out[h] ?? 0) + 1
  }
  return out
}

/** Free-text `order.paymentMethod` values, in plain words for the payment-mix donut. */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on delivery',
  manual: 'UPI or bank transfer',
  razorpay: 'Card, UPI or netbanking',
  razorpay_upi: 'UPI',
  gift_card: 'Gift card',
  store_credit: 'Store credit',
}

export function paymentMethodLabel(method: string | null): string {
  if (!method) return 'Other'
  return PAYMENT_METHOD_LABELS[method] ?? method
}

/** Where an order sits for the owner: shipped/delivered take priority over a stale "to ship". */
export function statusBucket(r: {
  status: string
  fulfillmentStatus: string
}): 'to_ship' | 'shipped' | 'delivered' | 'cancelled' | null {
  if (r.status === 'cancelled') return 'cancelled'
  if (r.fulfillmentStatus === 'delivered' || r.fulfillmentStatus === 'returned') return 'delivered'
  if (r.fulfillmentStatus === 'shipped' || r.fulfillmentStatus === 'partially_delivered') {
    return 'shipped'
  }
  if (r.fulfillmentStatus === 'unfulfilled' || r.fulfillmentStatus === 'partially_fulfilled') {
    return 'to_ship'
  }
  return null
}

/** Count `rows` into one bucket per day between `from` (inclusive) and `from + days`. */
function countByDay(rows: { at: Date; weight?: number }[], from: Date, days: number): number[] {
  const out = zeros(days)
  for (const r of rows) {
    const i = dayIndex(r.at, from, days)
    if (i >= 0) out[i] = (out[i] ?? 0) + (r.weight ?? 1)
  }
  return out
}

/**
 * End-of-day in-stock / out-of-stock counts for every day in the window, rebuilt
 * from today's levels by undoing the adjustment log backwards. A day with no
 * adjustments carries the next day's state, so the series never goes blank.
 */
function stockByDay(
  current: { variantId: string; available: number }[],
  adjustments: { variantId: string; delta: number; at: Date }[],
  from: Date,
  days: number,
): { inStock: number[]; outOfStock: number[] } {
  const deltaByDay = new Map<string, number[]>()
  for (const a of adjustments) {
    const i = dayIndex(a.at, from, days)
    if (i < 0) continue
    const arr = deltaByDay.get(a.variantId) ?? zeros(days)
    arr[i] = (arr[i] ?? 0) + a.delta
    deltaByDay.set(a.variantId, arr)
  }
  const inStock = zeros(days)
  const outOfStock = zeros(days)
  for (const v of current) {
    const deltas = deltaByDay.get(v.variantId)
    let available = v.available
    for (let d = days - 1; d >= 0; d--) {
      if (available > 0) inStock[d] = (inStock[d] ?? 0) + 1
      else outOfStock[d] = (outOfStock[d] ?? 0) + 1
      // Moving to the previous day's close means undoing everything logged on day `d`.
      available -= deltas?.[d] ?? 0
    }
  }
  return { inStock, outOfStock }
}

type SeriesInput = {
  orders: { placedAt: Date; totalPaise: number }[]
  customers: { at: Date }[]
  products: { at: Date }[]
  stock: { variantId: string; available: number }[]
  adjustments: { variantId: string; delta: number; at: Date }[]
}

/** One `DashboardSeries` for the `days` starting at `from` (IST midnight). */
export function buildSeries(input: SeriesInput, from: Date, days: number): DashboardSeries {
  const dayList = Array.from({ length: days }, (_, i) =>
    isoDate(new Date(from.getTime() + i * DAY_MS)),
  )
  const revenuePaise = countByDay(
    input.orders.map((o) => ({ at: o.placedAt, weight: o.totalPaise })),
    from,
    days,
  )
  const { inStock, outOfStock } = stockByDay(input.stock, input.adjustments, from, days)
  return {
    days: dayList,
    customers: countByDay(input.customers, from, days),
    products: countByDay(input.products, from, days),
    inStock,
    outOfStock,
    revenuePaise,
  }
}
