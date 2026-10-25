/**
 * Umami's API answers turned into what the Analytics page draws. Pure: the client fetches,
 * these only read. Written against Umami 3 (`/stats` returns plain numbers plus a
 * `comparison` object) and still reading Umami 2 (`{ value, prev }` per figure), so a store on
 * an older self-hosted Umami keeps working.
 */

/** The figures `/websites/:id/stats` returns for one period. */
export type UmamiTotals = {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
  /** Seconds spent across all visits. */
  totaltime: number
}

export type UmamiStats = { current: UmamiTotals; previous: UmamiTotals | null }

const TOTAL_KEYS = ['pageviews', 'visitors', 'visits', 'bounces', 'totaltime'] as const

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** A figure as Umami 3 (`12`) or Umami 2 (`{ value: 12, prev: 9 }`) sends it. */
const current = (v: unknown): number => (isRecord(v) ? num(v.value) : num(v))

export function toUmamiStats(raw: unknown): UmamiStats {
  const body = isRecord(raw) ? raw : {}
  const totals = (read: (key: (typeof TOTAL_KEYS)[number]) => number): UmamiTotals => ({
    pageviews: read('pageviews'),
    visitors: read('visitors'),
    visits: read('visits'),
    bounces: read('bounces'),
    totaltime: read('totaltime'),
  })
  const now = totals((k) => current(body[k]))
  if (isRecord(body.comparison)) {
    const before = body.comparison
    return { current: now, previous: totals((k) => current(before[k])) }
  }
  const hasPrev = TOTAL_KEYS.some((k) => isRecord(body[k]) && 'prev' in (body[k] as object))
  if (!hasPrev) return { current: now, previous: null }
  return {
    current: now,
    previous: totals((k) => {
      const v = body[k]
      return isRecord(v) ? num(v.prev) : 0
    }),
  }
}

export type UmamiKpiId = 'visitors' | 'visits' | 'pageviews' | 'bounceRate' | 'visitDuration'

export type UmamiKpi = {
  id: UmamiKpiId
  /** Counts as counts, `bounceRate` as a fraction (0.42), `visitDuration` in seconds. */
  value: number
  previous: number | null
  /** Fractional change, null when there is nothing to compare with. */
  delta: number | null
}

const bounceRate = (t: UmamiTotals) => (t.visits > 0 ? Math.min(1, t.bounces / t.visits) : 0)
const visitDuration = (t: UmamiTotals) => (t.visits > 0 ? t.totaltime / t.visits : 0)

const KPI_VALUE: Record<UmamiKpiId, (t: UmamiTotals) => number> = {
  visitors: (t) => t.visitors,
  visits: (t) => t.visits,
  pageviews: (t) => t.pageviews,
  bounceRate,
  visitDuration,
}

/** The tiles across the top of the visitor section, in order. */
export const UMAMI_KPIS: readonly UmamiKpiId[] = [
  'visitors',
  'visits',
  'pageviews',
  'bounceRate',
  'visitDuration',
]

export function umamiKpis(stats: UmamiStats): UmamiKpi[] {
  return UMAMI_KPIS.map((id) => {
    const value = KPI_VALUE[id](stats.current)
    const previous = stats.previous ? KPI_VALUE[id](stats.previous) : null
    const delta = previous ? (value - previous) / previous : null
    return { id, value, previous, delta }
  })
}

/** The `{ x, y }` rows Umami uses for time series and ranked metrics. */
type Point = { x: unknown; y: unknown }

const points = (raw: unknown): Point[] =>
  Array.isArray(raw) ? raw.filter((p): p is Point => isRecord(p) && 'y' in p) : []

/**
 * One value per day of `days` (ISO dates) from a daily series. Umami labels buckets with a
 * local date-time in the timezone asked for (`2026-10-01 00:00:00`, or ISO with a `T`); only
 * the date part is read, and days Umami left out are zero.
 */
export function toDailySeries(raw: unknown, days: readonly string[]): number[] {
  const byDay = new Map<string, number>()
  for (const p of points(raw)) {
    const day = String(p.x ?? '').slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + num(p.y))
  }
  return days.map((d) => byDay.get(d) ?? 0)
}

/** `/pageviews` answers `{ pageviews: [...], sessions: [...] }`; sessions are the visitors. */
export function toTrend(
  raw: unknown,
  days: readonly string[],
): { visitors: number[]; pageviews: number[] } {
  const body = isRecord(raw) ? raw : {}
  return {
    visitors: toDailySeries(body.sessions, days),
    pageviews: toDailySeries(body.pageviews, days),
  }
}

export type UmamiRow = {
  /** Null for Umami's empty bucket: a direct visit, a page with no campaign, an unknown country. */
  label: string | null
  count: number
  /** Of the rows shown, 0 to 1. */
  share: number
}

/** A ranked metric (`/metrics?type=…`): the top `limit` rows with their share. */
export function toRows(raw: unknown, limit = 10): UmamiRow[] {
  const rows = points(raw)
    .map((p) => {
      const label = typeof p.x === 'string' && p.x.trim() ? p.x.trim() : null
      return { label, count: num(p.y) }
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  return rows.map((r) => ({ ...r, share: total > 0 ? r.count / total : 0 }))
}

/** The ranked lists on the Analytics page. */
export const UMAMI_BREAKDOWNS = [
  'pages',
  'referrers',
  'campaigns',
  'devices',
  'browsers',
  'countries',
] as const
export type UmamiBreakdown = (typeof UMAMI_BREAKDOWNS)[number]

/**
 * The `type` Umami's metrics endpoint takes for each list, newest name first: Umami 3 calls
 * pages `path`, Umami 2 called them `url`. Campaigns (`utmCampaign`) are Umami 3 only.
 */
export const BREAKDOWN_TYPES: Record<UmamiBreakdown, readonly string[]> = {
  pages: ['path', 'url'],
  referrers: ['referrer'],
  campaigns: ['utmCampaign'],
  devices: ['device'],
  browsers: ['browser'],
  countries: ['country'],
}

/** Everything the visitor section draws for one range. */
export type UmamiReport = {
  kpis: UmamiKpi[]
  /** One value per day of the range, oldest first. */
  visitors: number[]
  pageviews: number[]
  breakdowns: Record<UmamiBreakdown, UmamiRow[]>
}
