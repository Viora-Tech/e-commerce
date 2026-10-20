/** SOURCE OF TRUTH: custom analytics query parser — WHAT: tokenize, parse and format the query language / WHY: one parser for the editor and the server */
import {
  COMPARE_OPTIONS,
  fieldOf,
  fieldsOf,
  QUERY_LIMIT_DEFAULT,
  QUERY_LIMIT_MAX,
  QUERY_TABLE_NAMES,
  type QueryCompare,
  type QueryTable,
  TIME_WORDS,
} from './schema'

/** `-30d` (days), `-4w` (weeks), `-3m` (months), a word, or an ISO date. */
export type QueryTime =
  | { kind: 'relative'; amount: number; unit: 'd' | 'w' | 'm' }
  | { kind: 'word'; word: (typeof TIME_WORDS)[number] }
  | { kind: 'date'; iso: string }

export type ParsedQuery = {
  table: QueryTable
  show: string[]
  groupBy: string | null
  since: QueryTime
  until: QueryTime
  compare: QueryCompare | null
  orderBy: { field: string; dir: 'asc' | 'desc' } | null
  limit: number
}

export type QueryError = { line: number; message: string; suggestion: string | null }

export type ParseResult = { ok: true; query: ParsedQuery } | { ok: false; error: QueryError }

type Token = { text: string; upper: string; line: number }

/** Words, numbers, `-30d`, ISO dates and commas, each with its 1-based line. */
export function tokenize(source: string): Token[] {
  const out: Token[] = []
  source.split('\n').forEach((raw, i) => {
    const line = raw.replace(/--.*$/, '')
    for (const m of line.matchAll(/,|[^\s,]+/g)) {
      out.push({ text: m[0], upper: m[0].toUpperCase(), line: i + 1 })
    }
  })
  return out
}

/** Edit distance, for "Did you mean net_sales?". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] as number
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j] as number
      row[j] = Math.min(cur + 1, (row[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length] as number
}

function closest(word: string, options: readonly string[]): string | null {
  let best: string | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const o of options) {
    const d = distance(word.toLowerCase(), o.toLowerCase())
    if (d < bestD) {
      best = o
      bestD = d
    }
  }
  return best && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null
}

class Problem extends Error {
  constructor(readonly error: QueryError) {
    super(error.message)
  }
}

function fail(line: number, message: string, suggestion: string | null = null): never {
  throw new Problem({ line, message, suggestion })
}

function parseTime(t: Token): QueryTime {
  const rel = /^-(\d{1,4})([dwm])$/i.exec(t.text)
  if (rel) {
    return { kind: 'relative', amount: Number(rel[1]), unit: rel[2]?.toLowerCase() as 'd' }
  }
  const word = TIME_WORDS.find((w) => w === t.text.toLowerCase())
  if (word) return { kind: 'word', word }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.text) && !Number.isNaN(Date.parse(t.text))) {
    return { kind: 'date', iso: t.text }
  }
  return fail(t.line, `“${t.text}” is not a time. Use -30d, -4w, -3m, today or 2026-10-01.`)
}

/** Reads a whole query, or the first problem in it with its line and a likely fix. */
export function parseQuery(source: string): ParseResult {
  const tokens = tokenize(source)
  let i = 0
  const peek = () => tokens[i]
  const next = (what: string): Token => {
    const t = tokens[i++]
    if (!t) return fail(tokens.at(-1)?.line ?? 1, `Expected ${what} at the end of the query.`)
    return t
  }
  const keyword = (word: string) => {
    const [a, b] = word.split(' ')
    if (peek()?.upper !== a) return false
    if (b && tokens[i + 1]?.upper !== b) return false
    i += b ? 2 : 1
    return true
  }

  try {
    if (!keyword('FROM')) fail(peek()?.line ?? 1, 'A query starts with FROM, e.g. FROM sales.')
    const tableToken = next('a table')
    const table = QUERY_TABLE_NAMES.find((n) => n === tableToken.text.toLowerCase())
    if (!table) {
      const s = closest(tableToken.text, QUERY_TABLE_NAMES)
      fail(tableToken.line, `Unknown table “${tableToken.text}”.`, s)
    }
    const t = table as QueryTable
    const names = fieldsOf(t).map((f) => f.name)

    if (!keyword('SHOW'))
      fail(peek()?.line ?? tableToken.line, 'Add SHOW and the numbers you want.')
    const show: string[] = []
    for (;;) {
      const f = next('a field')
      const field = fieldOf(t, f.text.toLowerCase())
      if (!field) fail(f.line, `Unknown field “${f.text}”.`, closest(f.text, names))
      if (field.role !== 'metric') {
        fail(f.line, `“${f.text}” splits rows; use it in GROUP BY, not SHOW.`)
      }
      show.push(field.name)
      if (peek()?.text !== ',') break
      i++
    }

    let groupBy: string | null = null
    let since: QueryTime = { kind: 'relative', amount: 30, unit: 'd' }
    let until: QueryTime = { kind: 'word', word: 'today' }
    let compare: QueryCompare | null = null
    let orderBy: ParsedQuery['orderBy'] = null
    let limit = QUERY_LIMIT_DEFAULT

    while (peek()) {
      const t0 = peek() as Token
      if (keyword('GROUP BY')) {
        const f = next('a field to group by')
        const field = fieldOf(t, f.text.toLowerCase())
        if (!field) fail(f.line, `Unknown field “${f.text}”.`, closest(f.text, names))
        if (field.role !== 'dimension')
          fail(f.line, `“${f.text}” is a number; GROUP BY needs a field like state or day.`)
        groupBy = f.text.toLowerCase()
      } else if (keyword('SINCE')) {
        since = parseTime(next('a time'))
      } else if (keyword('UNTIL')) {
        until = parseTime(next('a time'))
      } else if (keyword('COMPARE TO')) {
        const c = next('previous_period or previous_year')
        const opt = COMPARE_OPTIONS.find((o) => o === c.text.toLowerCase())
        if (!opt)
          fail(
            c.line,
            `Compare to previous_period or previous_year.`,
            closest(c.text, COMPARE_OPTIONS),
          )
        compare = opt as QueryCompare
      } else if (keyword('ORDER BY')) {
        const f = next('a field to sort by')
        const name = f.text.toLowerCase()
        if (!show.includes(name) && name !== groupBy) {
          fail(
            f.line,
            `Sort by a field the query shows or groups by.`,
            closest(f.text, [...show, ...(groupBy ? [groupBy] : [])]),
          )
        }
        const dir =
          peek()?.upper === 'ASC' || peek()?.upper === 'DESC'
            ? (next('').upper.toLowerCase() as 'asc' | 'desc')
            : 'desc'
        orderBy = { field: name, dir }
      } else if (keyword('LIMIT')) {
        const n = next('a number')
        const value = Number(n.text)
        if (!Number.isInteger(value) || value < 1 || value > QUERY_LIMIT_MAX) {
          fail(n.line, `LIMIT takes a whole number from 1 to ${QUERY_LIMIT_MAX}.`)
        }
        limit = value
      } else {
        const words = ['GROUP', 'SINCE', 'UNTIL', 'COMPARE', 'ORDER', 'LIMIT']
        fail(t0.line, `Unexpected “${t0.text}”.`, closest(t0.text, words))
      }
    }
    return { ok: true, query: { table: t, show, groupBy, since, until, compare, orderBy, limit } }
  } catch (err) {
    if (err instanceof Problem) return { ok: false, error: err.error }
    throw err
  }
}

const timeText = (t: QueryTime) =>
  t.kind === 'relative' ? `-${t.amount}${t.unit}` : t.kind === 'word' ? t.word : t.iso

/** The query laid out one clause per line ("Format"). */
export function formatQuery(q: ParsedQuery): string {
  const lines = [`FROM ${q.table}`, `  SHOW ${q.show.join(', ')}`]
  if (q.groupBy) lines.push(`  GROUP BY ${q.groupBy}`)
  lines.push(`  SINCE ${timeText(q.since)} UNTIL ${timeText(q.until)}`)
  if (q.compare) lines.push(`  COMPARE TO ${q.compare}`)
  if (q.orderBy) lines.push(`  ORDER BY ${q.orderBy.field} ${q.orderBy.dir.toUpperCase()}`)
  lines.push(`  LIMIT ${q.limit}`)
  return lines.join('\n')
}
