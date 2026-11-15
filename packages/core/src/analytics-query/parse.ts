/** SOURCE OF TRUTH: custom analytics query parser — WHAT: parse and format the query language / WHY: one parser for the editor, the AI and the server */
import { conditionFields, formatCondition, parseCondition, type QueryCondition } from './condition'
import { type QueryTime, queryDays, rangeProblem } from './period'
import {
  COMPARE_OPTIONS,
  fieldOf,
  fieldsOf,
  QUERY_GROUP_MAX,
  QUERY_LIMIT_DEFAULT,
  QUERY_LIMIT_MAX,
  QUERY_PERIODS,
  QUERY_TABLE_NAMES,
  type QueryCompare,
  type QueryPeriod,
  type QueryTable,
  TIME_WORDS,
} from './schema'
import { Cursor, closest, fail, Problem, type QueryError, type Token, tokenize } from './tokenize'

export { type QueryError, type Token, tokenize } from './tokenize'

export type ParsedQuery = {
  table: QueryTable
  show: string[]
  /** WHERE: which rows count, before they are added up. */
  where: QueryCondition | null
  /** GROUP BY: up to three dimensions, the first one leads. Empty: one total row. */
  groupBy: string[]
  /** HAVING: which groups to keep, on their added-up numbers. */
  having: QueryCondition | null
  since: QueryTime
  until: QueryTime
  /** DURING: a named range (this_month, all_time, …) instead of SINCE / UNTIL. */
  during: QueryPeriod | null
  compare: QueryCompare | null
  orderBy: { field: string; dir: 'asc' | 'desc' } | null
  limit: number
}

export type ParseResult = { ok: true; query: ParsedQuery } | { ok: false; error: QueryError }

const CLAUSES = [
  'WHERE',
  'GROUP',
  'HAVING',
  'SINCE',
  'UNTIL',
  'DURING',
  'COMPARE',
  'ORDER',
  'LIMIT',
]

function parseTime(t: Token): QueryTime {
  const rel = /^-(\d{1,4})([dwmy])$/i.exec(t.text)
  if (t.kind === 'word' && rel) {
    return { kind: 'relative', amount: Number(rel[1]), unit: rel[2]?.toLowerCase() as 'd' }
  }
  const word = TIME_WORDS.find((w) => w === t.text.toLowerCase())
  if (word) return { kind: 'word', word }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.text) && !Number.isNaN(Date.parse(t.text))) {
    return { kind: 'date', iso: t.text }
  }
  const period = QUERY_PERIODS.find((p) => p === t.text.toLowerCase())
  if (period) return fail(t.line, `Use DURING ${period} for a named range.`)
  return fail(t.line, `“${t.text}” is not a time. Use -30d, -4w, -3m, -2y, today or 2026-10-01.`)
}

function readGroupBy(c: Cursor, table: QueryTable, names: string[]): string[] {
  const out: string[] = []
  for (;;) {
    const f = c.next('a field to group by')
    const name = f.text.toLowerCase()
    const field = fieldOf(table, name)
    if (!field) fail(f.line, `Unknown field “${f.text}”.`, closest(f.text, names))
    if (field.role !== 'dimension')
      fail(f.line, `“${f.text}” is a number; GROUP BY needs a field like state or day.`)
    if (field.filterOnly) {
      fail(f.line, `“${name}” can only filter (one row can have many); use it in WHERE.`)
    }
    if (out.includes(name)) fail(f.line, `“${name}” is already in GROUP BY.`)
    out.push(name)
    if (out.length > QUERY_GROUP_MAX)
      fail(f.line, `GROUP BY takes at most ${QUERY_GROUP_MAX} fields.`)
    if (!c.symbol(',')) return out
  }
}

/**
 * Reads a whole query, or the first problem in it with its line and a likely fix. `now` places
 * relative dates, so a range that runs backwards or is too long is refused here.
 */
export function parseQuery(source: string, now: Date = new Date()): ParseResult {
  const c = new Cursor(tokenize(source))
  const seen = new Set<string>()
  const once = (t: Token, clause: string, hint = '') => {
    if (seen.has(clause)) fail(t.line, `${clause} appears twice.${hint}`)
    seen.add(clause)
  }

  try {
    const open = c.tokens.find((t) => t.kind === 'string' && t.open)
    if (open) fail(open.line, 'Close the quote around the value.')
    if (!c.keyword('FROM')) fail(c.line(), 'A query starts with FROM, e.g. FROM sales.')
    const tableToken = c.next('a table')
    const table = QUERY_TABLE_NAMES.find((n) => n === tableToken.text.toLowerCase())
    if (!table) {
      fail(
        tableToken.line,
        `Unknown table “${tableToken.text}”.`,
        closest(tableToken.text, QUERY_TABLE_NAMES),
      )
    }
    const t = table as QueryTable
    const names = fieldsOf(t).map((f) => f.name)

    if (!c.keyword('SHOW')) fail(c.line(), 'Add SHOW and the numbers you want.')
    const show: string[] = []
    for (;;) {
      const f = c.next('a field')
      const field = fieldOf(t, f.text.toLowerCase())
      if (!field) fail(f.line, `Unknown field “${f.text}”.`, closest(f.text, names))
      if (field.role !== 'metric') {
        fail(f.line, `“${f.text}” splits rows; use it in GROUP BY, not SHOW.`)
      }
      if (!show.includes(field.name)) show.push(field.name)
      if (!c.symbol(',')) break
    }

    let where: QueryCondition | null = null
    let groupBy: string[] = []
    let having: QueryCondition | null = null
    let since: QueryTime = { kind: 'relative', amount: 30, unit: 'd' }
    let until: QueryTime = { kind: 'word', word: 'today' }
    let during: QueryPeriod | null = null
    let compare: QueryCompare | null = null
    let orderBy: ParsedQuery['orderBy'] = null
    let limit = QUERY_LIMIT_DEFAULT
    let havingLine = 0
    let orderLine = 0

    while (c.peek()) {
      const t0 = c.peek() as Token
      if (c.keyword('WHERE')) {
        once(t0, 'WHERE', ' Join conditions with AND or OR.')
        where = parseCondition(c, t, 'where')
      } else if (c.keyword('GROUP BY')) {
        once(t0, 'GROUP BY', ' List the fields after one GROUP BY, with commas.')
        groupBy = readGroupBy(c, t, names)
      } else if (c.keyword('HAVING')) {
        once(t0, 'HAVING', ' Join conditions with AND or OR.')
        havingLine = t0.line
        having = parseCondition(c, t, 'having')
      } else if (c.keyword('SINCE')) {
        once(t0, 'SINCE')
        since = parseTime(c.next('a time'))
      } else if (c.keyword('UNTIL')) {
        once(t0, 'UNTIL')
        until = parseTime(c.next('a time'))
      } else if (c.keyword('DURING')) {
        once(t0, 'DURING')
        const p = c.next('a range like last_month or all_time')
        const period = QUERY_PERIODS.find((o) => o === p.text.toLowerCase())
        if (!period)
          fail(p.line, `“${p.text}” is not a range DURING knows.`, closest(p.text, QUERY_PERIODS))
        during = period
      } else if (c.keyword('COMPARE TO')) {
        once(t0, 'COMPARE TO')
        const v = c.next('previous_period or previous_year')
        const opt = COMPARE_OPTIONS.find((o) => o === v.text.toLowerCase())
        if (!opt)
          fail(
            v.line,
            `Compare to previous_period or previous_year.`,
            closest(v.text, COMPARE_OPTIONS),
          )
        compare = opt
      } else if (c.keyword('ORDER BY')) {
        once(t0, 'ORDER BY')
        const f = c.next('a field to sort by')
        const dir =
          c.peek()?.upper === 'ASC' || c.peek()?.upper === 'DESC'
            ? (c.next('').upper.toLowerCase() as 'asc' | 'desc')
            : 'desc'
        orderBy = { field: f.text.toLowerCase(), dir }
        orderLine = f.line
      } else if (c.keyword('LIMIT')) {
        once(t0, 'LIMIT')
        const n = c.next('a number')
        const value = Number(n.text)
        if (!Number.isInteger(value) || value < 1 || value > QUERY_LIMIT_MAX) {
          fail(n.line, `LIMIT takes a whole number from 1 to ${QUERY_LIMIT_MAX}.`)
        }
        limit = value
      } else {
        fail(
          t0.line,
          `Unexpected “${t0.text}”.`,
          t0.kind === 'word' ? closest(t0.text, CLAUSES) : null,
        )
      }
    }

    // Checked at the end, so ORDER BY may come before the GROUP BY it sorts by.
    if (orderBy && !show.includes(orderBy.field) && !groupBy.includes(orderBy.field)) {
      const options = [...show, ...groupBy]
      fail(
        orderLine,
        `Sort by a field the query shows or groups by.`,
        closest(orderBy.field, options),
      )
    }
    if (having && !groupBy.length) {
      fail(havingLine, 'HAVING keeps some groups: add GROUP BY first, or filter rows with WHERE.')
    }
    if (during && (seen.has('SINCE') || seen.has('UNTIL'))) {
      fail(c.tokens.at(-1)?.line ?? 1, 'Use DURING or SINCE / UNTIL, not both.')
    }
    const problem =
      during === 'all_time' ? null : rangeProblem(queryDays({ since, until, during }, now))
    if (problem) {
      const at = c.tokens.find(
        (x) => x.upper === 'SINCE' || x.upper === 'DURING' || x.upper === 'UNTIL',
      )
      fail(at?.line ?? 1, problem)
    }
    return {
      ok: true,
      query: {
        table: t,
        show,
        where,
        groupBy,
        having,
        since,
        until,
        during,
        compare,
        orderBy,
        limit,
      },
    }
  } catch (err) {
    if (err instanceof Problem) return { ok: false, error: err.error }
    throw err
  }
}

/** Every field a query reads, in any clause. */
export function queryFields(q: ParsedQuery): string[] {
  return [
    ...new Set([
      ...q.show,
      ...q.groupBy,
      ...conditionFields(q.where),
      ...conditionFields(q.having),
    ]),
  ]
}

const timeText = (t: QueryTime) =>
  t.kind === 'relative' ? `-${t.amount}${t.unit}` : t.kind === 'word' ? t.word : t.iso

/** The query laid out one clause per line ("Format"). */
export function formatQuery(q: ParsedQuery): string {
  const lines = [`FROM ${q.table}`, `  SHOW ${q.show.join(', ')}`]
  if (q.where) lines.push(`  WHERE ${formatCondition(q.where)}`)
  if (q.groupBy.length) lines.push(`  GROUP BY ${q.groupBy.join(', ')}`)
  if (q.having) lines.push(`  HAVING ${formatCondition(q.having)}`)
  lines.push(
    q.during ? `  DURING ${q.during}` : `  SINCE ${timeText(q.since)} UNTIL ${timeText(q.until)}`,
  )
  if (q.compare) lines.push(`  COMPARE TO ${q.compare}`)
  if (q.orderBy) lines.push(`  ORDER BY ${q.orderBy.field} ${q.orderBy.dir.toUpperCase()}`)
  lines.push(`  LIMIT ${q.limit}`)
  return lines.join('\n')
}
