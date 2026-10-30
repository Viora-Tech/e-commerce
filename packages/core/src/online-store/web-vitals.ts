/** SOURCE OF TRUTH: Web performance — WHAT: Core Web Vitals readings the storefront sends from shoppers' browsers (LCP, INP, CLS), saved anonymously, and the Online store page's summary (p75 of the last 28 days with Google's Good / Needs work / Poor bands, page loads by device) / WHY: Shopify shows real-user speed on its Online store page; we had no Web Vitals at all (#124) */
import {
  type StoreTx,
  WEB_VITAL_DEVICES,
  WEB_VITAL_METRICS,
  type WebVitalDevice,
  type WebVitalMetric,
  webVital,
} from '@commerce/db'
import { and, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'

/** Google's thresholds (web.dev/vitals): at or under `good` is Good, over `poor` is Poor. */
export const WEB_VITAL_THRESHOLDS: Record<WebVitalMetric, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
}

export type WebVitalRating = 'good' | 'needs-work' | 'poor'

export function rateWebVital(metric: WebVitalMetric, value: number): WebVitalRating {
  const t = WEB_VITAL_THRESHOLDS[metric]
  if (value <= t.good) return 'good'
  return value > t.poor ? 'poor' : 'needs-work'
}

/** The days the summary covers, as Google's CrUX report does. */
export const WEB_VITAL_WINDOW_DAYS = 28
/** Readings a metric needs before its p75 means anything; under it the strip says "Collecting data". */
export const WEB_VITAL_MIN_SAMPLES = 20
/** Readings one beacon may carry (a page sends at most one of each metric). */
const MAX_READINGS = 3

/** What one page sends: its path, its device class and up to one reading per metric. */
export const WebVitalBeaconSchema = z.object({
  path: z.string().max(500).default('/'),
  device: z.enum(WEB_VITAL_DEVICES),
  readings: z
    .array(
      z.object({
        metric: z.enum(WEB_VITAL_METRICS),
        // Anything past a minute (or a CLS over 10) is a broken measurement, not a slow page.
        value: z.number().finite().min(0).max(60_000),
      }),
    )
    .min(1)
    .max(MAX_READINGS),
})
export type WebVitalBeacon = z.infer<typeof WebVitalBeaconSchema>

/** The path without its query or hash, so no search terms or tokens are kept. */
function cleanPath(path: string): string {
  const bare = path.split(/[?#]/)[0] ?? '/'
  return bare.startsWith('/') ? bare.slice(0, 300) : '/'
}

/** Saves one page's readings. CLS values over 10 are dropped as broken. */
export async function recordWebVitals(
  tx: StoreTx,
  storeId: string,
  beacon: WebVitalBeacon,
): Promise<number> {
  const rows = beacon.readings
    .filter((r) => r.metric !== 'CLS' || r.value <= 10)
    .map((r) => ({
      storeId,
      metric: r.metric,
      value: r.value,
      device: beacon.device,
      path: cleanPath(beacon.path),
    }))
  if (rows.length > 0) await tx.insert(webVital).values(rows)
  return rows.length
}

export type WebVitalSummary = {
  metric: WebVitalMetric
  /** Null while there are fewer than `WEB_VITAL_MIN_SAMPLES` readings. */
  p75: number | null
  rating: WebVitalRating | null
  samples: number
}

export type WebPerformance = {
  windowDays: number
  /** Enough page loads for a report; otherwise the strip shows "Collecting data". */
  ready: boolean
  metrics: WebVitalSummary[]
  /** Page loads in the window by device class (one LCP is reported per page load). */
  pageLoads: Record<WebVitalDevice, number>
}

/** The Online store page's strip: p75 per metric over the last 28 days, and loads by device. */
export async function webPerformance(tx: StoreTx, now = new Date()): Promise<WebPerformance> {
  const since = new Date(now.getTime() - WEB_VITAL_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const recent = gte(webVital.createdAt, since)
  const byMetric = await tx
    .select({
      metric: webVital.metric,
      samples: sql<number>`count(*)::int`,
      p75: sql<number | null>`percentile_cont(0.75) within group (order by ${webVital.value})`,
    })
    .from(webVital)
    .where(recent)
    .groupBy(webVital.metric)
  const byDevice = await tx
    .select({ device: webVital.device, loads: sql<number>`count(*)::int` })
    .from(webVital)
    .where(and(recent, eq(webVital.metric, 'LCP')))
    .groupBy(webVital.device)
  const metrics = WEB_VITAL_METRICS.map((metric): WebVitalSummary => {
    const row = byMetric.find((r) => r.metric === metric)
    const samples = row?.samples ?? 0
    const p75 = samples >= WEB_VITAL_MIN_SAMPLES && row?.p75 != null ? Number(row.p75) : null
    return { metric, p75, rating: p75 === null ? null : rateWebVital(metric, p75), samples }
  })
  const pageLoads = Object.fromEntries(
    WEB_VITAL_DEVICES.map((d) => [d, byDevice.find((r) => r.device === d)?.loads ?? 0]),
  ) as Record<WebVitalDevice, number>
  return {
    windowDays: WEB_VITAL_WINDOW_DAYS,
    ready: metrics.some((m) => m.p75 !== null),
    metrics,
    pageLoads,
  }
}
