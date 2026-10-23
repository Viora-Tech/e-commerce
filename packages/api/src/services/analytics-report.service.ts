import type { StoreTx } from '@commerce/db'
import { DAY_MS, istIsoDate, type RangeInput, resolveRange } from './analytics-buckets'
import { findReport, type ReportDefinition } from './analytics-reports'
import { customerBuilders } from './reports/customers'
import { fulfilmentBuilders } from './reports/fulfilment'
import { inventoryBuilders } from './reports/inventory'
import { orderBuilders } from './reports/orders'
import { paymentBuilders } from './reports/payments'
import { profitBuilders } from './reports/profit'
import { salesBuilders } from './reports/sales'
import type {
  ProfitInsights,
  ReportBuilder,
  ReportData,
  ReportRow,
  ReportSpan,
  ReportValue,
} from './reports/types'

export type { ProfitInsights, ReportRow, ReportValue } from './reports/types'

const BUILDERS: Record<string, ReportBuilder> = {
  ...salesBuilders,
  ...orderBuilders,
  ...paymentBuilders,
  ...profitBuilders,
  ...fulfilmentBuilders,
  ...customerBuilders,
  ...inventoryBuilders,
}

const BAR_ROWS = 10
const FALLBACK = 'sales-over-time'

/** `label` is the raw first-column value (a date, state code, name); the admin formats it. */
export type ReportChartPoint = { label: string; value: number; previous: number | null }

export type ReportResult = {
  slug: string
  range: { key: string; from: string; to: string; days: string[] }
  /** The span compared against; null for snapshot reports. */
  previousRange: { from: string; to: string } | null
  rows: ReportRow[]
  totals: Record<string, ReportValue>
  previousTotals: Record<string, ReportValue> | null
  chart: ReportChartPoint[]
  /** Profit reports only: averages, net profit and how much is still estimated. */
  profit: ProfitInsights | null
}

const num = (v: ReportValue | undefined): number | null => (typeof v === 'number' ? v : null)

function previousSpan(span: ReportSpan, from: Date): ReportSpan {
  return {
    from,
    to: span.from,
    days: span.days.map((_, i) => istIsoDate(new Date(from.getTime() + i * DAY_MS))),
    now: span.now,
  }
}

/** The line or bars above the table, each point paired with its previous-period twin. */
function chartOf(
  report: ReportDefinition,
  current: ReportData,
  previous: ReportData | null,
): ReportChartPoint[] {
  if (current.series) {
    return current.series.map((p, i) => ({
      ...p,
      previous: previous?.series?.[i]?.value ?? null,
    }))
  }
  const daily = report.columns[0]?.kind === 'date'
  if (report.chart === 'series') {
    return current.rows.map((r, i) => ({
      label: String(r.values[report.columns[0]?.id ?? ''] ?? ''),
      value: num(r.values[report.metric]) ?? 0,
      previous: daily && previous ? num(previous.rows[i]?.values[report.metric]) : null,
    }))
  }
  return current.rows
    .filter((r) => (num(r.values[report.metric]) ?? 0) > 0)
    .slice(0, BAR_ROWS)
    .map((r) => ({
      label: String(r.values[report.columns[0]?.id ?? ''] ?? ''),
      value: num(r.values[report.metric]) ?? 0,
      previous: r.previous ?? null,
    }))
}

/**
 * Rows, totals and a chart for one report, plus the same report for the span
 * immediately before so every figure can show a change. Unknown slugs fall
 * back to sales over time.
 */
export async function analyticsReport(
  tx: StoreTx,
  slug: string,
  opts: { range?: RangeInput; now?: Date } = {},
): Promise<ReportResult> {
  const found = findReport(slug)
  const report = (found?.available ? found : findReport(FALLBACK)) as ReportDefinition
  const build = BUILDERS[report.slug] as ReportBuilder
  const now = opts.now ?? new Date()
  const range = resolveRange(opts.range ?? { key: '30d' }, now)
  const span: ReportSpan = { from: range.from, to: range.to, days: range.days, now }
  const before = report.ranged ? previousSpan(span, range.previousFrom) : null

  const current = await build(tx, span)
  const previous = before ? await build(tx, before) : null
  const previousByKey = new Map(
    (previous?.rows ?? []).map((r) => [r.key, num(r.values[report.metric])]),
  )
  const daily = report.columns[0]?.kind === 'date'

  return {
    slug: report.slug,
    range: {
      key: report.ranged ? range.key : 'today',
      from: range.days[0] ?? '',
      to: range.days.at(-1) ?? '',
      days: range.days,
    },
    previousRange: before ? { from: before.days[0] ?? '', to: before.days.at(-1) ?? '' } : null,
    rows: current.rows.map((r, i) => ({
      ...r,
      previous: !previous
        ? null
        : daily
          ? num(previous.rows[i]?.values[report.metric])
          : (previousByKey.get(r.key) ?? null),
    })),
    totals: current.totals,
    previousTotals: previous?.totals ?? null,
    chart: chartOf(report, current, previous),
    profit: current.profit ?? null,
  }
}
