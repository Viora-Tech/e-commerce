import { notTestOrder } from '@commerce/core'
import {
  addDays,
  daysBetween,
  fieldOf,
  formatQuery,
  type ParsedQuery,
  parseQuery,
  type QueryDays,
  type QueryError,
  type QueryFieldType,
  queryDays,
  queryFields,
  rangeProblem,
} from '@commerce/core/analytics-query'
import { dayKey } from '@commerce/dates'
import { order, type StoreTx } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'
import { istDayStart } from './analytics-buckets'
import {
  type CustomerNames,
  havingSql,
  type TableSql,
  tableSql,
  whereSql,
} from './analytics-query-sql'
import type { ReportResult } from './analytics-report.service'
import type { ReportColumnKind, ReportDefinition } from './analytics-reports'
import type { ReportRow, ReportValue } from './reports/types'

/*
 * Custom analytics queries (Figma "Analytics · Report — query editor"). The query is parsed by
 * the same code the editor runs, then every field becomes one of the fixed expressions in
 * `analytics-query-sql.ts` and every typed value a bound parameter: a merchant's text never
 * reaches SQL. Reads only, inside the caller's store transaction (RLS), under a time limit.
 */

const KIND: Record<QueryFieldType, ReportColumnKind> = {
  money: 'money',
  number: 'count',
  text: 'text',
  date: 'date',
  month: 'month',
  state: 'state',
  payment: 'payment',
}

/** A query that takes longer than this is stopped (the whole history stays well under it). */
const STATEMENT_TIMEOUT = '15s'
/** Days listed in the result's range; a longer range sends none (the rows carry the dates). */
const LISTED_DAYS_MAX = 400

type Span = { from: Date; to: Date }

const spanOf = (days: QueryDays): Span => ({
  from: istDayStart(days.from),
  to: istDayStart(addDays(days.to, 1)),
})

/** What the query runs as: SQL fragments for one table and how names may show. */
type Plan = { q: ParsedQuery; t: TableSql; where: SQL | null; having: SQL | null }

async function run(tx: StoreTx, plan: Plan, span: Span, grouped: boolean) {
  const { q, t } = plan
  const dims = grouped ? q.groupBy : []
  const select = [
    ...dims.map((d, i) => sql`${t.exprs[d] as SQL} as ${sql.identifier(`k${i}`)}`),
    ...q.show.map((m) => sql`${t.exprs[m] as SQL} as ${sql.identifier(m)}`),
  ]
  const conditions = [
    t.base, // Bound as ISO text: a raw statement does not map a Date the way a column does.
    sql`${t.at} >= ${span.from.toISOString()}::timestamptz`,
    sql`${t.at} < ${span.to.toISOString()}::timestamptz`,
  ]
  if (plan.where) conditions.push(plan.where)
  const parts = [
    sql`select ${sql.join(select, sql`, `)} from ${t.from} where ${sql.join(conditions, sql` and `)}`,
  ]
  if (dims.length) {
    // By position: a dimension and its sort are one expression, written once.
    const positions = dims.map((_, i) => sql.raw(String(i + 1)))
    parts.push(sql`group by ${sql.join(positions, sql`, `)}`)
    if (plan.having) parts.push(sql`having ${plan.having}`)
    const sortAt = q.orderBy
      ? q.groupBy.includes(q.orderBy.field)
        ? q.groupBy.indexOf(q.orderBy.field) + 1
        : dims.length + q.show.indexOf(q.orderBy.field) + 1
      : null
    const sorts = [
      ...(sortAt
        ? [sql.raw(`${sortAt} ${q.orderBy?.dir === 'asc' ? 'asc' : 'desc'} nulls last`)]
        : []),
      ...positions.map((p) => sql`${p} asc`),
    ]
    parts.push(sql`order by ${sql.join(sorts, sql`, `)}`)
    parts.push(sql`limit ${q.limit}`)
  }
  return (await tx.execute(sql.join(parts, sql` `))) as unknown as Record<string, unknown>[]
}

/** The store's first counted day, for DURING all_time (fast: the store/placed index). */
async function firstDay(tx: StoreTx): Promise<string | null> {
  const rows = (await tx.execute(
    sql`select to_char(min(${order.placedAt}) at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as first
      from ${order} where ${order.status} <> 'draft' and ${notTestOrder}`,
  )) as unknown as { first: string | null }[]
  return rows[0]?.first ?? null
}

const value = (v: unknown): ReportValue =>
  v == null ? null : typeof v === 'number' ? v : /^-?\d+$/.test(String(v)) ? Number(v) : String(v)

const keyOf = (r: Record<string, unknown>, dims: number) =>
  dims ? Array.from({ length: dims }, (_, i) => String(r[`k${i}`] ?? '')).join(' · ') : 'total'

export type CustomQueryResult =
  | {
      ok: true
      report: ReportDefinition
      result: ReportResult
      ms: number
      /** The query as it ran, one clause per line. */
      query: string
      /** The days it covered; for DURING all_time, from the store's first order. */
      days: QueryDays
    }
  | { ok: false; error: QueryError }

export type CustomQueryOptions = {
  now?: Date
  /** Full names for staff who read customers (default), first names for the AI, else none. */
  customerNames?: CustomerNames
}

/** Parses, checks and runs one custom query for the current store. */
export async function runCustomQuery(
  tx: StoreTx,
  source: string,
  options: CustomQueryOptions = {},
): Promise<CustomQueryResult> {
  const now = options.now ?? new Date()
  const names = options.customerNames ?? 'full'
  const parsed = parseQuery(source, now)
  if (!parsed.ok) return parsed
  const q = parsed.query
  if (names === 'hidden' && queryFields(q).includes('customer_name')) {
    return {
      ok: false,
      error: { line: 1, message: 'Your role cannot see customer names.', suggestion: null },
    }
  }
  const started = performance.now()
  await tx.execute(sql.raw(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`))

  const days = queryDays(q, now, q.during === 'all_time' ? await firstDay(tx) : null)
  const problem = rangeProblem(days)
  if (problem) return { ok: false, error: { line: 1, message: problem, suggestion: null } }
  const length = daysBetween(days.from, days.to)
  const span = spanOf(days)
  const before: Span | null =
    q.compare === 'previous_period'
      ? spanOf({ from: addDays(days.from, -length), to: addDays(days.from, -1) })
      : q.compare === 'previous_year'
        ? spanOf({ from: lastYear(days.from), to: lastYear(days.to) })
        : null

  const t = tableSql(q.table, names)
  const plan: Plan = {
    q,
    t,
    where: q.where ? whereSql(q.where, t, q.table) : null,
    having: q.having ? havingSql(q.having, t, q.table) : null,
  }
  const grouped = q.groupBy.length > 0
  const rows = grouped ? await run(tx, plan, span, true) : null
  const totalsRow = await run(tx, plan, span, false)
  const prevRows = before && grouped ? await run(tx, plan, before, true) : null
  const prevTotals = before ? await run(tx, plan, before, false) : null

  const metric =
    q.orderBy && q.show.includes(q.orderBy.field) ? q.orderBy.field : (q.show[0] as string)
  const dimFields = q.groupBy.map((d) => fieldOf(q.table, d)).filter((f) => f !== undefined)
  const columns = [
    ...dimFields.map((f) => ({ id: f.name, kind: KIND[f.type] })),
    ...q.show.map((m) => ({
      id: m,
      kind: KIND[(fieldOf(q.table, m)?.type ?? 'number') as QueryFieldType],
    })),
  ]
  const dims = q.groupBy.length
  const prevByKey = new Map(
    (prevRows ?? prevTotals ?? []).map((r) => [keyOf(r, prevRows ? dims : 0), value(r[metric])]),
  )
  const toRow = (r: Record<string, unknown>, grouping: number): ReportRow => {
    const key = keyOf(r, grouping)
    const values: Record<string, ReportValue> = {}
    dimFields.forEach((f, i) => {
      values[f.name] = grouping ? String(r[`k${i}`] ?? '') : null
    })
    for (const m of q.show) values[m] = value(r[m])
    const prev = prevByKey.get(key)
    return { key, values, previous: typeof prev === 'number' ? prev : null }
  }
  const resultRows = rows ? rows.map((r) => toRow(r, dims)) : totalsRow.map((r) => toRow(r, 0))
  const totals = Object.fromEntries(q.show.map((m) => [m, value(totalsRow[0]?.[m])]))
  const series = dims === 1 && ['day', 'week', 'month', 'year'].includes(q.groupBy[0] as string)

  const report: ReportDefinition = {
    slug: 'custom',
    title: 'Custom query',
    description: '',
    category: 'sales',
    available: true,
    columns,
    metric,
    chart: series ? 'series' : 'bars',
    ranged: true,
  }
  const listed =
    length <= LISTED_DAYS_MAX ? Array.from({ length }, (_, i) => addDays(days.from, i)) : []
  const result: ReportResult = {
    slug: 'custom',
    range: { key: 'custom', from: days.from, to: days.to, days: listed },
    previousRange: before
      ? { from: dayKey(before.from), to: dayKey(new Date(before.to.getTime() - 1)) }
      : null,
    rows: resultRows,
    totals,
    previousTotals: prevTotals
      ? Object.fromEntries(q.show.map((m) => [m, value(prevTotals[0]?.[m])]))
      : null,
    chart: resultRows.slice(0, series ? undefined : 12).map((r) => ({
      label: r.key,
      value: typeof r.values[metric] === 'number' ? (r.values[metric] as number) : 0,
      previous: r.previous ?? null,
    })),
    profit: null,
  }
  return {
    ok: true,
    report,
    result,
    ms: Math.round(performance.now() - started),
    query: formatQuery(q),
    days,
  }
}

/** The same calendar day a year earlier (29 Feb becomes 28 Feb). */
function lastYear(day: string): string {
  const [y, m, d] = day.split('-') as [string, string, string]
  const prev = `${Number(y) - 1}-${m}-${d}`
  return Number.isNaN(Date.parse(prev)) || new Date(`${prev}T00:00:00Z`).getUTCDate() !== Number(d)
    ? `${Number(y) - 1}-${m}-28`
    : prev
}
