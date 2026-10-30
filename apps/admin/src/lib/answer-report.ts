/**
 * An AI answer's table as a report (#102). A table whose numbers fit a custom query opens in
 * the query editor and runs live there; any other table becomes a snapshot: the rows as the
 * AI read them, carried to the snapshot page in sessionStorage and saved under the `answer`
 * report slug. Pure apart from the storage helpers, which never throw.
 */
import type {
  AnswerSnapshot,
  AnswerTable,
  ReportColumnKind,
  ReportDefinition,
  ReportResult,
  ReportValue,
} from '@commerce/api'
import { routes } from './routes'

/** The report slug saved answer snapshots are filed under (the API's `ANSWER_REPORT_SLUG`). */
export const ANSWER_SLUG = 'answer'

const STASH_KEY = 'admin-answer-report:v1'

const numberOf = (v: ReportValue | undefined): number => (typeof v === 'number' ? v : 0)

const SUMMED: ReadonlySet<ReportColumnKind> = new Set(['count', 'money'])

/** The snapshot of one answer's table: what the merchant asked, which tool, when. */
export function snapshotOf(
  table: AnswerTable,
  meta: { tool: string; question: string; answeredAt: Date },
): AnswerSnapshot {
  return {
    question: meta.question.slice(0, 500),
    tool: meta.tool,
    answeredAt: meta.answeredAt.toISOString(),
    columns: table.columns,
    rows: table.rows,
    chart: table.chart,
    range: table.range,
  }
}

/** Where "Open as report" goes: the query editor with the query, else the snapshot page. */
export function openAsReportHref(table: AnswerTable): string {
  return table.query
    ? `${routes.analytics.query()}?q=${encodeURIComponent(table.query)}`
    : routes.analytics.answer()
}

/**
 * A snapshot in the shapes the report page draws (`ReportChart`, `ReportTable`): the chart's
 * y column is the metric; with a chart, money and count columns are totalled.
 */
export function answerReport(
  snapshot: AnswerSnapshot,
  title: string,
): { report: ReportDefinition; result: ReportResult } {
  const firstNumeric = snapshot.columns.find((c) => SUMMED.has(c.kind))
  const metric = snapshot.chart?.y ?? firstNumeric?.id ?? snapshot.columns[0]?.id ?? ''
  const x = snapshot.chart?.x ?? snapshot.columns[0]?.id ?? ''
  const rows = snapshot.rows.map((r) => ({
    key: r.key,
    values: r.values as Record<string, ReportValue>,
    previous: null,
  }))
  const totals: Record<string, ReportValue> = snapshot.chart
    ? Object.fromEntries(
        snapshot.columns
          .filter((c) => SUMMED.has(c.kind))
          .map((c) => [c.id, rows.reduce((n, r) => n + numberOf(r.values[c.id]), 0)]),
      )
    : {}
  const range = snapshot.range ?? {
    from: snapshot.answeredAt.slice(0, 10),
    to: snapshot.answeredAt.slice(0, 10),
  }
  return {
    report: {
      slug: ANSWER_SLUG,
      title,
      description: snapshot.question,
      category: 'sales',
      available: true,
      columns: snapshot.columns,
      metric,
      chart: snapshot.chart?.kind === 'line' ? 'series' : 'bars',
      ranged: false,
    },
    result: {
      slug: ANSWER_SLUG,
      range: { key: 'custom', from: range.from, to: range.to, days: [] },
      previousRange: null,
      rows,
      totals,
      previousTotals: null,
      chart: snapshot.chart
        ? rows.map((r) => ({
            label: String(r.values[x] ?? ''),
            value: numberOf(r.values[metric]),
            previous: null,
          }))
        : [],
      profit: null,
    },
  }
}

/** Hands a snapshot to the snapshot page in this tab. */
export function stashAnswer(snapshot: AnswerSnapshot): void {
  try {
    window.sessionStorage.setItem(STASH_KEY, JSON.stringify(snapshot))
  } catch {
    // Private mode or full storage: the snapshot page says there is nothing to show.
  }
}

/** The snapshot handed over by `stashAnswer`, or null. */
export function stashedAnswer(): AnswerSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(STASH_KEY)
    const value = raw ? (JSON.parse(raw) as AnswerSnapshot) : null
    return value && Array.isArray(value.columns) && Array.isArray(value.rows) ? value : null
  } catch {
    return null
  }
}
