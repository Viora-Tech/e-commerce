/**
 * Pure time, bucketing and rate maths for the analytics section. No database,
 * no clock of its own: every function takes what it needs, so the report
 * numbers can be tested directly.
 *
 * Days are Indian Standard Time (fixed +05:30, no DST), matching the dashboard.
 */

export const IST_OFFSET_MS = 5.5 * 3_600_000
export const DAY_MS = 86_400_000

/** Ranges the picker offers; `custom` carries its own from/to. */
export type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom'

export type RangeInput = {
  key: RangeKey
  /** ISO dates (YYYY-MM-DD), only read when `key` is `custom`. */
  from?: string | undefined
  to?: string | undefined
}

export type ResolvedRange = {
  key: RangeKey
  /** Start of the first day, IST midnight. */
  from: Date
  /** Exclusive end: midnight after the last day. */
  to: Date
  /** Same span immediately before `from`, for period-over-period deltas. */
  previousFrom: Date
  previousTo: Date
  /** ISO dates covered, oldest first. */
  days: string[]
}

export const DEFAULT_RANGE = '30d' as const
const RANGE_DAYS: Record<Exclude<RangeKey, 'custom'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}
/** A custom range wider than this is clamped: the day arrays drive chart widths. */
const MAX_CUSTOM_DAYS = 365

/** Midnight `daysAgo` days before `now`, in IST. */
export function startOfIstDay(now: Date, daysAgo = 0): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS)
  const midnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysAgo,
  )
  return new Date(midnight - IST_OFFSET_MS)
}

/** ISO date of an instant, read in IST. */
export function istIsoDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** IST midnight that opens the given ISO date. */
export function istDayStart(iso: string): Date {
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() - IST_OFFSET_MS)
}

function listDays(from: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => istIsoDate(new Date(from.getTime() + i * DAY_MS)))
}

/** Turns a picker selection into concrete instants plus the matching previous period. */
export function resolveRange(input: RangeInput, now = new Date()): ResolvedRange {
  if (input.key === 'custom' && input.from && input.to) {
    const first = istDayStart(input.from)
    const lastDay = istDayStart(input.to)
    const span = Math.floor((lastDay.getTime() - first.getTime()) / DAY_MS) + 1
    const count = Math.min(MAX_CUSTOM_DAYS, Math.max(1, span))
    const to = new Date(first.getTime() + count * DAY_MS)
    return {
      key: 'custom',
      from: first,
      to,
      previousFrom: new Date(first.getTime() - count * DAY_MS),
      previousTo: first,
      days: listDays(first, count),
    }
  }
  const key: Exclude<RangeKey, 'custom'> = input.key === 'custom' ? DEFAULT_RANGE : input.key
  const count = RANGE_DAYS[key]
  const from = startOfIstDay(now, count - 1)
  const to = new Date(startOfIstDay(now).getTime() + DAY_MS)
  return {
    key,
    from,
    to,
    previousFrom: new Date(from.getTime() - count * DAY_MS),
    previousTo: from,
    days: listDays(from, count),
  }
}

/** Sums `weight` (default 1) into one bucket per day of `days`; instants outside are dropped. */
export function bucketByDay(rows: { at: Date; weight?: number }[], days: string[]): number[] {
  const index = new Map(days.map((d, i) => [d, i]))
  const out = days.map(() => 0)
  for (const r of rows) {
    const i = index.get(istIsoDate(r.at))
    if (i === undefined) continue
    out[i] = (out[i] ?? 0) + (r.weight ?? 1)
  }
  return out
}

export type SeriesPoint = { label: string; value: number }

/** Daily values, labelled by ISO date. */
export function toDailyPoints(days: string[], values: number[]): SeriesPoint[] {
  return days.map((d, i) => ({ label: d, value: values[i] ?? 0 }))
}

/** Daily values folded into 7-day buckets, labelled by the week's first day. */
export function toWeeklyPoints(days: string[], values: number[]): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let i = 0; i < days.length; i += 7) {
    const label = days[i] ?? ''
    let value = 0
    for (let j = i; j < Math.min(i + 7, days.length); j++) value += values[j] ?? 0
    out.push({ label, value })
  }
  return out
}

/** Share of sessions that placed an order, 0 when nobody visited. */
export function conversionRate(orders: number, sessions: number): number {
  return sessions > 0 ? orders / sessions : 0
}

/** Mean order value in paise, rounded to the paisa. */
export function averageOrderValue(revenuePaise: number, orders: number): number {
  return orders > 0 ? Math.round(revenuePaise / orders) : 0
}

/** Share of orders placed by someone who had ordered before. */
export function returningRate(returningOrders: number, orders: number): number {
  return orders > 0 ? returningOrders / orders : 0
}

/** Fractional change against the previous period; null when there is nothing to compare. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return (current - previous) / previous
}

export type FunnelStep = {
  id: 'sessions' | 'carts' | 'checkouts' | 'orders'
  value: number
  /** Share of the first step. */
  share: number
  /** Share of the step before, null for the first. */
  stepRate: number | null
}

export type FunnelInput = {
  sessions: number
  carts: number
  checkouts: number
  orders: number
}

/**
 * Sessions to orders. Every step reports its own count, so the funnel can never
 * contradict the tile above it; `share` is against the widest step, which is
 * what sizes the bars. `stepRate` is the drop from the step before and is left
 * unknown when a step is larger than the one before it: that means the two came
 * from different sources (orders placed without a recorded cart, carts without
 * a recorded session), not that more than everyone converted.
 */
export function buildFunnel(input: FunnelInput): FunnelStep[] {
  const ordered: { id: FunnelStep['id']; value: number }[] = [
    { id: 'sessions', value: input.sessions },
    { id: 'carts', value: input.carts },
    { id: 'checkouts', value: input.checkouts },
    { id: 'orders', value: input.orders },
  ]
  const top = Math.max(...ordered.map((s) => s.value))
  return ordered.map((step, i) => {
    const before = ordered[i - 1]?.value
    const comparable = before !== undefined && before > 0 && step.value <= before
    return {
      id: step.id,
      value: step.value,
      share: top > 0 ? step.value / top : 0,
      stepRate: before === undefined ? null : comparable ? step.value / before : null,
    }
  })
}
