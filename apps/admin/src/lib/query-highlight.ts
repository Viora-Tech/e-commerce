import {
  COMPARE_OPTIONS,
  QUERY_PERIODS,
  QUERY_TABLE_NAMES,
  QUERY_TABLES,
} from '@commerce/core/analytics-query'

export type QueryTone = 'plain' | 'keyword' | 'field' | 'value' | 'comment'
export type QueryToken = { text: string; tone: QueryTone }

const KEYWORDS = new Set([
  'FROM',
  'SHOW',
  'WHERE',
  'GROUP',
  'BY',
  'HAVING',
  'SINCE',
  'UNTIL',
  'DURING',
  'COMPARE',
  'TO',
  'ORDER',
  'LIMIT',
  'ASC',
  'DESC',
  'AND',
  'OR',
  'NOT',
  'IN',
  'CONTAINS',
  'STARTS',
  'ENDS',
  'WITH',
])
const NAMES = new Set<string>([
  ...QUERY_TABLE_NAMES,
  ...Object.values(QUERY_TABLES).flatMap((t) => t.fields.map((f) => f.name)),
])
const WORDS = new Set<string>(['today', 'yesterday', ...COMPARE_OPTIONS, ...QUERY_PERIODS])
const VALUES = /^(-\d+[dwmy]|-?\d+(\.\d+)?|\d{4}-\d{2}(-\d{2})?)$/i
const PIECES = /\s+|'(?:[^']|'')*'?|"[^"]*"?|--.*$|[(),]|[=<>!]+|[^\s,()'"=<>!]+/g

/** One line of a query as coloured pieces: keywords, known tables and fields, values, comments. */
export function highlightQueryLine(line: string): QueryToken[] {
  const out: QueryToken[] = []
  for (const m of line.matchAll(PIECES)) {
    const text = m[0]
    const tone: QueryTone = text.startsWith('--')
      ? 'comment'
      : text.startsWith("'") || text.startsWith('"')
        ? 'value'
        : KEYWORDS.has(text.toUpperCase())
          ? 'keyword'
          : NAMES.has(text.toLowerCase())
            ? 'field'
            : VALUES.test(text) || WORDS.has(text.toLowerCase())
              ? 'value'
              : 'plain'
    out.push({ text, tone })
  }
  return out
}
