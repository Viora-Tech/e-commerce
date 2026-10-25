import { QUERY_TABLE_NAMES, QUERY_TABLES } from '@commerce/core/analytics-query'

export type QueryTone = 'plain' | 'keyword' | 'field' | 'value' | 'comment'
export type QueryToken = { text: string; tone: QueryTone }

const KEYWORDS = new Set([
  'FROM',
  'SHOW',
  'GROUP',
  'BY',
  'SINCE',
  'UNTIL',
  'COMPARE',
  'TO',
  'ORDER',
  'LIMIT',
  'ASC',
  'DESC',
])
const NAMES = new Set<string>([
  ...QUERY_TABLE_NAMES,
  ...Object.values(QUERY_TABLES).flatMap((t) => t.fields.map((f) => f.name)),
])
const VALUES = /^(-\d+[dwm]|\d+|\d{4}-\d{2}-\d{2}|today|yesterday|previous_period|previous_year)$/i

/** One line of a query as coloured pieces: keywords, known tables and fields, values. */
export function highlightQueryLine(line: string): QueryToken[] {
  const comment = line.indexOf('--')
  const code = comment >= 0 ? line.slice(0, comment) : line
  const out: QueryToken[] = []
  for (const m of code.matchAll(/\s+|,|[^\s,]+/g)) {
    const text = m[0]
    const tone: QueryTone = KEYWORDS.has(text.toUpperCase())
      ? 'keyword'
      : NAMES.has(text.toLowerCase())
        ? 'field'
        : VALUES.test(text)
          ? 'value'
          : 'plain'
    out.push({ text, tone })
  }
  if (comment >= 0) out.push({ text: line.slice(comment), tone: 'comment' })
  return out
}
