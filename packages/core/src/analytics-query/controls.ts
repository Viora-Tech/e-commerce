/** SOURCE OF TRUTH: custom analytics query controls — WHAT: edits a parsed query the way the editor's controls do / WHY: the controls and the text stay one query */
import { dayKey } from '@commerce/dates'
import type { ParsedQuery, QueryTime } from './parse'
import {
  fieldsOf,
  QUERY_LIMIT_MAX,
  type QueryCompare,
  type QueryField,
  type QueryTable,
} from './schema'

/*
 * The editor's controls (table, metrics, dimension, sort, limit, dates, compare) never build
 * text themselves: each one edits the parsed query here and the editor formats it back, so a
 * control can only ever produce a query the parser accepts.
 */

export const metricsOf = (table: QueryTable): QueryField[] =>
  fieldsOf(table).filter((f) => f.role === 'metric')

export const dimensionsOf = (table: QueryTable): QueryField[] =>
  fieldsOf(table).filter((f) => f.role === 'dimension')

/** Drops a sort that no longer points at a shown or grouped field, as the parser would refuse it. */
function keepSort(q: ParsedQuery): ParsedQuery {
  if (!q.orderBy) return q
  const ok = q.show.includes(q.orderBy.field) || q.orderBy.field === q.groupBy
  return ok ? q : { ...q, orderBy: null }
}

/** Another table: keeps the metrics and dimension it also has, else its first metric. */
export function setTable(q: ParsedQuery, table: QueryTable): ParsedQuery {
  if (table === q.table) return q
  const metrics = metricsOf(table).map((f) => f.name)
  const dims = dimensionsOf(table).map((f) => f.name)
  const show = q.show.filter((m) => metrics.includes(m))
  return keepSort({
    ...q,
    table,
    show: show.length ? show : metrics.slice(0, 1),
    groupBy: q.groupBy && dims.includes(q.groupBy) ? q.groupBy : null,
  })
}

/** The metrics in the table's order; a query always shows at least one, so none is refused. */
export function setShow(q: ParsedQuery, show: readonly string[]): ParsedQuery {
  const ordered = metricsOf(q.table)
    .map((f) => f.name)
    .filter((m) => show.includes(m))
  return ordered.length ? keepSort({ ...q, show: ordered }) : q
}

export function toggleMetric(q: ParsedQuery, metric: string): ParsedQuery {
  return setShow(
    q,
    q.show.includes(metric) ? q.show.filter((m) => m !== metric) : [...q.show, metric],
  )
}

export function setGroupBy(q: ParsedQuery, groupBy: string | null): ParsedQuery {
  const ok = groupBy === null || dimensionsOf(q.table).some((f) => f.name === groupBy)
  return ok ? keepSort({ ...q, groupBy }) : q
}

export function setOrderBy(
  q: ParsedQuery,
  field: string | null,
  dir: 'asc' | 'desc' = 'desc',
): ParsedQuery {
  if (field === null) return { ...q, orderBy: null }
  return keepSort({ ...q, orderBy: { field, dir } })
}

export function setLimit(q: ParsedQuery, limit: number): ParsedQuery {
  const n = Math.round(limit)
  return Number.isFinite(n) ? { ...q, limit: Math.min(QUERY_LIMIT_MAX, Math.max(1, n)) } : q
}

export function setCompare(q: ParsedQuery, compare: QueryCompare | null): ParsedQuery {
  return { ...q, compare }
}

export function setRange(q: ParsedQuery, since: QueryTime, until: QueryTime): ParsedQuery {
  return { ...q, since, until }
}

/** The quick ranges the Reports date picker offers, as SINCE / UNTIL. */
export const QUERY_RANGE_KEYS = ['today', '7d', '30d', '90d'] as const
export type QueryRangeKey = (typeof QUERY_RANGE_KEYS)[number]

const TODAY: QueryTime = { kind: 'word', word: 'today' }

export function rangeTimes(key: QueryRangeKey): { since: QueryTime; until: QueryTime } {
  if (key === 'today') return { since: TODAY, until: TODAY }
  return { since: { kind: 'relative', amount: Number.parseInt(key, 10), unit: 'd' }, until: TODAY }
}

/** Which quick range the query's SINCE / UNTIL is, or null for anything else. */
export function rangeKeyOf(q: Pick<ParsedQuery, 'since' | 'until'>): QueryRangeKey | null {
  if (q.until.kind !== 'word' || q.until.word !== 'today') return null
  if (q.since.kind === 'word') return q.since.word === 'today' ? 'today' : null
  if (q.since.kind !== 'relative' || q.since.unit !== 'd') return null
  return QUERY_RANGE_KEYS.find((k) => k === `${(q.since as { amount: number }).amount}d`) ?? null
}

const DAY_MS = 86_400_000

/** The IST calendar day a SINCE / UNTIL value points at, the way the server reads it. */
export function queryDay(t: QueryTime, now: Date = new Date()): string {
  if (t.kind === 'date') return t.iso
  if (t.kind === 'word')
    return dayKey(new Date(now.getTime() - (t.word === 'yesterday' ? DAY_MS : 0)))
  const d = new Date(now)
  if (t.unit === 'm') d.setUTCMonth(d.getUTCMonth() - t.amount)
  else d.setTime(d.getTime() - t.amount * (t.unit === 'w' ? 7 : 1) * DAY_MS)
  return dayKey(d)
}
