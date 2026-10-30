/**
 * Tables and charts in AI answers (#192) and an answer kept as a report (#102). A read tool
 * may return a `table` next to its `facts`: columns, rows of raw values (paise, counts, ISO
 * days) and an optional chart. The assistant takes the table off before the model sees the
 * output (`detachTable`) and hands it straight to the admin, so the model never writes a
 * cell. When the same numbers can be asked as a custom query, the table carries that query
 * and "Open as report" opens it live; otherwise the merchant can only keep a snapshot
 * (`AnswerSnapshotSchema`, saved under the `answer` report slug). Pure: no database here.
 */
import { dayKey } from '@commerce/dates'
import { z } from 'zod'
import type { ReportColumnKind } from '../analytics-reports'

export const ANSWER_TABLE_LIMITS = { rows: 62, columns: 8, text: 200 } as const

export type AnswerColumn = { id: string; kind: ReportColumnKind }
export type AnswerCell = string | number | null
export type AnswerRow = { key: string; values: Record<string, AnswerCell> }
/** A line or bar over time (`x` is a day or month column) or bars by category. */
export type AnswerChart = { kind: 'line' | 'bar'; x: string; y: string }

export type AnswerTable = {
  columns: AnswerColumn[]
  rows: AnswerRow[]
  chart: AnswerChart | null
  /** The same numbers as a custom query (Reports → Custom query); null when none fits. */
  query: string | null
  /** The days the table covers, in the store's time zone, when it covers a period. */
  range: { from: string; to: string } | null
}

/** One input the model gave a tool, as plain text for "Show query". */
export type CallInput = { key: string; value: string }

const clip = (text: string) =>
  text.length > ANSWER_TABLE_LIMITS.text ? `${text.slice(0, ANSWER_TABLE_LIMITS.text - 1)}…` : text

/**
 * A tool's table, cut to the limits: at most 8 columns and 62 rows, text cells clipped, and a
 * chart only when both its columns are in the table.
 */
export function answerTable(input: {
  columns: AnswerColumn[]
  rows: { key?: string; values: Record<string, AnswerCell> }[]
  chart?: AnswerChart | null
  query?: string | null
  range?: { from: string; to: string } | null
}): AnswerTable {
  const columns = input.columns.slice(0, ANSWER_TABLE_LIMITS.columns)
  const ids = new Set(columns.map((c) => c.id))
  const rows = input.rows.slice(0, ANSWER_TABLE_LIMITS.rows).map((row, i) => ({
    key: row.key ?? String(i),
    values: Object.fromEntries(
      columns.map((c) => {
        const v = row.values[c.id]
        return [c.id, typeof v === 'string' ? clip(v) : typeof v === 'number' ? v : null]
      }),
    ),
  }))
  const chart = input.chart && ids.has(input.chart.x) && ids.has(input.chart.y) ? input.chart : null
  return { columns, rows, chart, query: input.query ?? null, range: input.range ?? null }
}

/** What the model reads instead of the rows: a note that the merchant sees them as a table. */
export const TABLE_SHOWN =
  'The merchant sees these numbers as a table under your answer. Do not list every row again.'

/**
 * Splits a tool's output: the model gets everything but `table` (plus `ref`, so the answer's
 * event can find the table again, and a note when there was one); the table goes to the UI.
 */
export function detachTable(
  output: unknown,
  ref: string,
): { modelOutput: Record<string, unknown>; table: AnswerTable | null } {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { modelOutput: { result: output ?? null, ref }, table: null }
  }
  const { table, ...rest } = output as Record<string, unknown> & { table?: unknown }
  const valid = isAnswerTable(table) ? table : null
  return {
    modelOutput: { ...rest, ...(valid ? { table: TABLE_SHOWN } : {}), ref },
    table: valid,
  }
}

function isAnswerTable(value: unknown): value is AnswerTable {
  const t = value as AnswerTable | null | undefined
  return Boolean(t && Array.isArray(t.columns) && Array.isArray(t.rows))
}

/** The inputs a tool ran with, flattened to short text: `period: this_month`, `limit: 5`. */
export function callInputs(input: unknown): CallInput[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return []
  return Object.entries(input as Record<string, unknown>).flatMap(([key, value]) => {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return [{ key, value: String(value) }]
    }
    if (typeof value === 'string' && value.trim()) {
      return [{ key, value: value.trim().slice(0, 100) }]
    }
    return []
  })
}

const DAY_MS = 86_400_000

/** Every calendar day from `from` to `to` (both `YYYY-MM-DD`, both included). */
export function daysFrom(from: string, to: string): string[] {
  const out: string[] = []
  const end = new Date(`${to}T00:00:00Z`).getTime()
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= end && out.length < 400; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** Every calendar month (`YYYY-MM`) the days `from`–`to` touch. */
export function monthsFrom(from: string, to: string): string[] {
  const out: string[] = []
  let [y, m] = from.slice(0, 7).split('-').map(Number) as [number, number]
  const last = to.slice(0, 7)
  while (out.length < 400) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key >= last) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** The store-time days a window covers; `to` is exclusive (a running period ends at now). */
export function windowDays(from: Date, to: Date, timeZone: string): { from: string; to: string } {
  const last = new Date(Math.max(to.getTime() - 1, from.getTime()))
  return { from: dayKey(from, timeZone), to: dayKey(last, timeZone) }
}

/** Longer periods than this chart by month, so a year never becomes 365 rows. */
export const DAILY_MAX_DAYS = 62

/**
 * A daily (or monthly) series with no gaps: buckets the query found keep their numbers, the
 * rest read zero, in calendar order.
 */
export function fillSeries(
  bucketColumn: string,
  buckets: string[],
  found: { bucket: string; values: Record<string, number> }[],
  metrics: string[],
): { key: string; values: Record<string, number | string> }[] {
  const byBucket = new Map(found.map((f) => [f.bucket, f.values]))
  return buckets.map((bucket) => {
    const hit = byBucket.get(bucket)
    return {
      key: bucket,
      values: Object.fromEntries([
        [bucketColumn, bucket],
        ...metrics.map((m) => [m, hit?.[m] ?? 0]),
      ]),
    }
  })
}

/* ---------- The same numbers as a custom query ---------- */

/**
 * Sales per day (or month) over `range`, compared with the period before: what `salesSummary`'s
 * table shows. The custom query's total sales is what shoppers paid on orders not cancelled.
 */
export function salesSeriesQuery(range: { from: string; to: string }, by: 'day' | 'month'): string {
  return [
    'FROM sales',
    '  SHOW total_sales, orders',
    `  GROUP BY ${by}`,
    `  SINCE ${range.from} UNTIL ${range.to}`,
    '  COMPARE TO previous_period',
    '  LIMIT 400',
  ].join('\n')
}

/** Best sellers by units over `range`: what `topProducts`'s table shows. */
export function topProductsQuery(range: { from: string; to: string }, limit: number): string {
  return [
    'FROM products',
    '  SHOW net_quantity, gross_sales',
    '  GROUP BY product_title',
    `  SINCE ${range.from} UNTIL ${range.to}`,
    '  ORDER BY net_quantity DESC',
    `  LIMIT ${Math.max(1, Math.min(limit, 100))}`,
  ].join('\n')
}

/* ---------- An answer kept as a report ---------- */

/** The report slug a saved answer snapshot is filed under; its JSON lives in `query`. */
export const ANSWER_REPORT_SLUG = 'answer'

const KINDS = [
  'text',
  'date',
  'month',
  'state',
  'payment',
  'label',
  'count',
  'money',
  'percent',
  'decimal',
  'hours',
  'days',
] as const satisfies readonly ReportColumnKind[]

const cell = z.union([z.string().max(ANSWER_TABLE_LIMITS.text), z.number().finite(), z.null()])
const columnId = z.string().min(1).max(40)

/** A table saved as it was when the AI answered: the numbers do not update. */
export const AnswerSnapshotSchema = z.object({
  /** The question the merchant asked, as the report's subtitle. */
  question: z.string().max(500),
  /** The tool that read the numbers (`topProducts`). */
  tool: z.string().min(1).max(60),
  /** When the AI answered (ISO). */
  answeredAt: z.iso.datetime(),
  columns: z
    .array(z.object({ id: columnId, kind: z.enum(KINDS) }))
    .min(1)
    .max(ANSWER_TABLE_LIMITS.columns),
  rows: z
    .array(z.object({ key: z.string().max(200), values: z.record(columnId, cell) }))
    .max(ANSWER_TABLE_LIMITS.rows),
  chart: z.object({ kind: z.enum(['line', 'bar']), x: columnId, y: columnId }).nullable(),
  range: z.object({ from: z.iso.date(), to: z.iso.date() }).nullable(),
})

export type AnswerSnapshot = z.infer<typeof AnswerSnapshotSchema>

/** A saved snapshot's JSON read back; null when it is not one (never trusted blindly). */
export function parseSnapshot(text: string | null | undefined): AnswerSnapshot | null {
  if (!text) return null
  try {
    const parsed = AnswerSnapshotSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
