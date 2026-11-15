/** SOURCE OF TRUTH: custom analytics query controls — WHAT: edits a parsed query the way the editor's controls do / WHY: the controls and the text stay one query */
import { conditionFields } from './condition'
import type { ParsedQuery } from './parse'
import { type QueryTime, timeDay } from './period'
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

/** Dimensions rows can be grouped by (filter-only ones like collection left out). */
export const dimensionsOf = (table: QueryTable): QueryField[] =>
  fieldsOf(table).filter((f) => f.role === 'dimension' && !f.filterOnly)

/** Every field WHERE can filter on. */
export const filtersOf = (table: QueryTable): QueryField[] =>
  fieldsOf(table).filter((f) => f.role === 'dimension')

/** Drops a sort that no longer points at a shown or grouped field, as the parser would refuse it. */
function keepSort(q: ParsedQuery): ParsedQuery {
  if (!q.orderBy) return q
  const ok = q.show.includes(q.orderBy.field) || q.groupBy.includes(q.orderBy.field)
  return ok ? q : { ...q, orderBy: null }
}

/**
 * Another table: keeps the metrics, dimensions and filters it also has, else its first metric.
 * A WHERE or HAVING that reads a field the new table lacks is dropped whole, never half-kept.
 */
export function setTable(q: ParsedQuery, table: QueryTable): ParsedQuery {
  if (table === q.table) return q
  const metrics = metricsOf(table).map((f) => f.name)
  const dims = dimensionsOf(table).map((f) => f.name)
  const filters = filtersOf(table).map((f) => f.name)
  const show = q.show.filter((m) => metrics.includes(m))
  const keeps = (c: ParsedQuery['where'], names: string[]) =>
    conditionFields(c).every((f) => names.includes(f)) ? c : null
  const groupBy = q.groupBy.filter((d) => dims.includes(d))
  return keepSort({
    ...q,
    table,
    show: show.length ? show : metrics.slice(0, 1),
    groupBy,
    where: keeps(q.where, filters),
    having: groupBy.length ? keeps(q.having, metrics) : null,
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

/** The leading dimension (the Dimension control); any further GROUP BY fields stay after it. */
export function setGroupBy(q: ParsedQuery, groupBy: string | null): ParsedQuery {
  if (groupBy === null) return keepSort({ ...q, groupBy: [], having: null })
  if (!dimensionsOf(q.table).some((f) => f.name === groupBy)) return q
  return keepSort({ ...q, groupBy: [groupBy, ...q.groupBy.slice(1).filter((d) => d !== groupBy)] })
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
  return { ...q, since, until, during: null }
}

/** The quick ranges the Reports date picker offers, as SINCE / UNTIL. */
const QUERY_RANGE_KEYS = ['today', '7d', '30d', '90d'] as const
export type QueryRangeKey = (typeof QUERY_RANGE_KEYS)[number]

const TODAY: QueryTime = { kind: 'word', word: 'today' }

export function rangeTimes(key: QueryRangeKey): { since: QueryTime; until: QueryTime } {
  if (key === 'today') return { since: TODAY, until: TODAY }
  return { since: { kind: 'relative', amount: Number.parseInt(key, 10), unit: 'd' }, until: TODAY }
}

/** Which quick range the query's SINCE / UNTIL is, or null for anything else. */
export function rangeKeyOf(
  q: Pick<ParsedQuery, 'since' | 'until'> & { during?: ParsedQuery['during'] },
): QueryRangeKey | null {
  if (q.during) return q.during === 'today' ? 'today' : null
  if (q.until.kind !== 'word' || q.until.word !== 'today') return null
  if (q.since.kind === 'word') return q.since.word === 'today' ? 'today' : null
  if (q.since.kind !== 'relative' || q.since.unit !== 'd') return null
  return QUERY_RANGE_KEYS.find((k) => k === `${(q.since as { amount: number }).amount}d`) ?? null
}

/** The IST calendar day a SINCE / UNTIL value points at, the way the server reads it. */
export const queryDay = (t: QueryTime, now: Date = new Date()): string => timeDay(t, now)
