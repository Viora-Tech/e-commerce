/** SOURCE OF TRUTH: custom analytics query conditions — WHAT: WHERE and HAVING parsed into a tree and formatted back / WHY: filters are checked against the table's own fields before the server binds their values */
import { CONDITION_WORDS, fieldOf, fieldsOf, QUERY_KEYWORDS, type QueryTable } from './schema'
import { type Cursor, closest, fail } from './tokenize'

export type QueryOperator =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'in'
  | 'contains'
  | 'starts_with'
  | 'ends_with'

/**
 * A WHERE or HAVING clause. WHERE values are always text (compared case-insensitively on the
 * server); HAVING values are numbers, rupees for money.
 */
export type QueryCondition =
  | { kind: 'and' | 'or'; items: QueryCondition[] }
  | { kind: 'not'; item: QueryCondition }
  | { kind: 'compare'; field: string; op: QueryOperator; values: (string | number)[] }

const CONDITION_LIMITS = { comparisons: 20, inValues: 50, depth: 8, text: 200 } as const

const ORDERED = ['<', '<=', '>', '>='] as const
const CLAUSE_STARTS = new Set(QUERY_KEYWORDS.map((k) => k.split(' ')[0] as string))

type Mode = 'where' | 'having'

type State = { cursor: Cursor; table: QueryTable; mode: Mode; comparisons: number }

function fieldNames(table: QueryTable, mode: Mode): string[] {
  return fieldsOf(table)
    .filter((f) => (mode === 'where' ? f.role === 'dimension' : f.role === 'metric'))
    .map((f) => f.name)
}

function readField(s: State): string {
  const t = s.cursor.next(s.mode === 'where' ? 'a field to filter on' : 'a number to filter on')
  const name = t.text.toLowerCase()
  const field = t.kind === 'word' ? fieldOf(s.table, name) : undefined
  if (!field) {
    const hint = t.kind === 'string' ? ' Quotes go around the value, not the field.' : ''
    fail(t.line, `Unknown field “${t.text}”.${hint}`, closest(t.text, fieldNames(s.table, s.mode)))
  }
  if (s.mode === 'where' && field.role === 'metric') {
    fail(
      t.line,
      `“${name}” is a number added up over rows; filter it with HAVING, e.g. HAVING ${name} > 10.`,
    )
  }
  if (s.mode === 'having' && field.role !== 'metric') {
    fail(
      t.line,
      `HAVING filters numbers like ${fieldNames(s.table, 'having')[0]}; put “${name}” in WHERE.`,
    )
  }
  return name
}

/** One value: quoted text in WHERE (a bare number or date is fine too), a number in HAVING. */
function readValue(s: State): string | number {
  const t = s.cursor.next('a value')
  if (t.kind === 'string' && t.open) fail(t.line, 'Close the quote around the value.')
  if (s.mode === 'having') {
    const n = Number(t.text)
    if (t.kind !== 'word' || !Number.isFinite(n)) {
      fail(t.line, `HAVING compares with a number, e.g. > 10 (money in rupees).`)
    }
    return n
  }
  if (t.kind === 'string') {
    if (t.text.length > CONDITION_LIMITS.text) {
      fail(t.line, `Keep a value under ${CONDITION_LIMITS.text} characters.`)
    }
    return t.text
  }
  if (t.kind === 'word' && /^-?\d+(\.\d+)?$|^\d{4}-\d{2}(-\d{2})?$/.test(t.text)) return t.text
  return fail(t.line, `Put text in quotes, e.g. '${t.text}'.`)
}

function readOperator(s: State, field: string): { op: QueryOperator; negate: boolean } {
  const c = s.cursor
  const negate = c.keyword('NOT')
  if (c.keyword('IN')) return { op: 'in', negate }
  if (c.keyword('CONTAINS')) return { op: 'contains', negate }
  if (c.keyword('STARTS WITH')) return { op: 'starts_with', negate }
  if (c.keyword('ENDS WITH')) return { op: 'ends_with', negate }
  const t = c.peek()
  if (!negate && t?.kind === 'op') {
    c.i++
    return { op: t.text as QueryOperator, negate: false }
  }
  const line = t?.line ?? c.line()
  return s.mode === 'where'
    ? fail(line, `After ${field} use =, !=, <, >, IN (…), CONTAINS, STARTS WITH or ENDS WITH.`)
    : fail(line, `After ${field} use =, !=, <, <=, > or >= and a number.`)
}

function comparison(s: State): QueryCondition {
  const field = readField(s)
  const { op, negate } = readOperator(s, field)
  if (s.mode === 'having' && !['=', '!=', ...ORDERED].includes(op)) {
    fail(s.cursor.line(), `HAVING compares numbers with =, !=, <, <=, > or >=.`)
  }
  s.comparisons += 1
  if (s.comparisons > CONDITION_LIMITS.comparisons) {
    fail(s.cursor.line(), `Use at most ${CONDITION_LIMITS.comparisons} comparisons.`)
  }
  const values: (string | number)[] = []
  if (op === 'in') {
    if (!s.cursor.symbol('('))
      fail(s.cursor.line(), `IN takes a list in brackets, e.g. IN ('MH', 'KA').`)
    for (;;) {
      values.push(readValue(s))
      if (values.length > CONDITION_LIMITS.inValues) {
        fail(s.cursor.line(), `IN takes at most ${CONDITION_LIMITS.inValues} values.`)
      }
      if (s.cursor.symbol(',')) continue
      if (s.cursor.symbol(')')) break
      fail(s.cursor.line(), 'Close the IN list with ).')
    }
  } else {
    const v = readValue(s)
    if (op !== '=' && op !== '!=' && v === '') {
      fail(s.cursor.line(), 'Give some text to compare with.')
    }
    values.push(v)
  }
  const node: QueryCondition = { kind: 'compare', field, op, values }
  return negate ? { kind: 'not', item: node } : node
}

function primary(s: State, depth: number): QueryCondition {
  if (depth > CONDITION_LIMITS.depth) fail(s.cursor.line(), 'Too many brackets inside each other.')
  if (s.cursor.keyword('NOT')) return { kind: 'not', item: primary(s, depth + 1) }
  if (s.cursor.symbol('(')) {
    const inner = orExpr(s, depth + 1)
    if (!s.cursor.symbol(')')) fail(s.cursor.line(), 'Close the bracket with ).')
    return inner
  }
  return comparison(s)
}

/** `a AND (b AND c)` is one AND of three, so formatting and parsing again give the same tree. */
function joined(kind: 'and' | 'or', items: QueryCondition[]): QueryCondition {
  const flat = items.flatMap((i) => (i.kind === kind ? i.items : [i]))
  return flat.length === 1 ? (flat[0] as QueryCondition) : { kind, items: flat }
}

function andExpr(s: State, depth: number): QueryCondition {
  const items = [primary(s, depth)]
  while (s.cursor.keyword('AND')) items.push(primary(s, depth))
  return joined('and', items)
}

function orExpr(s: State, depth: number): QueryCondition {
  const items = [andExpr(s, depth)]
  while (s.cursor.keyword('OR')) items.push(andExpr(s, depth))
  return joined('or', items)
}

/**
 * Reads a WHERE or HAVING condition up to the next clause. `a AND b OR c` is `(a AND b) OR c`;
 * NOT binds tightest.
 */
export function parseCondition(cursor: Cursor, table: QueryTable, mode: Mode): QueryCondition {
  const s: State = { cursor, table, mode, comparisons: 0 }
  const out = orExpr(s, 0)
  const t = cursor.peek()
  if (t && !(t.kind === 'word' && CLAUSE_STARTS.has(t.upper))) {
    const words = [...CONDITION_WORDS.map((w) => w.split(' ')[0] as string), ...CLAUSE_STARTS]
    const hint = t.kind === 'word' ? closest(t.text, words) : null
    fail(t.line, `Unexpected “${t.text}”. Join conditions with AND or OR.`, hint)
  }
  return out
}

/** Every field a condition reads. */
export function conditionFields(c: QueryCondition | null): string[] {
  if (!c) return []
  if (c.kind === 'compare') return [c.field]
  if (c.kind === 'not') return conditionFields(c.item)
  return c.items.flatMap(conditionFields)
}

const text = (v: string | number) =>
  typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`

const OP_TEXT: Record<QueryOperator, string> = {
  '=': '=',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  in: 'IN',
  contains: 'CONTAINS',
  starts_with: 'STARTS WITH',
  ends_with: 'ENDS WITH',
}

function compareText(c: Extract<QueryCondition, { kind: 'compare' }>, negate: boolean): string {
  const values = c.op === 'in' ? `(${c.values.map(text).join(', ')})` : text(c.values[0] ?? '')
  return `${c.field} ${negate ? 'NOT ' : ''}${OP_TEXT[c.op]} ${values}`
}

/** The condition as query text, with brackets only where they are needed. */
export function formatCondition(
  c: QueryCondition,
  parent: 'and' | 'or' | 'not' | null = null,
): string {
  if (c.kind === 'compare') return compareText(c, false)
  if (c.kind === 'not') {
    const inner = c.item
    if (inner.kind === 'compare' && !['=', '!=', ...ORDERED].includes(inner.op)) {
      return compareText(inner, true)
    }
    return `NOT ${formatCondition(inner, 'not')}`
  }
  const body = c.items.map((i) => formatCondition(i, c.kind)).join(` ${c.kind.toUpperCase()} `)
  const wrap = parent === 'not' || (parent === 'and' && c.kind === 'or')
  return wrap ? `(${body})` : body
}
