/** SOURCE OF TRUTH: custom analytics query suggestions — WHAT: completions for the query editor / WHY: the same vocabulary as the parser */
import { tokenize } from './parse'
import {
  COMPARE_OPTIONS,
  fieldsOf,
  QUERY_TABLE_NAMES,
  type QueryFieldType,
  type QueryTable,
  TIME_WORDS,
} from './schema'

export type QuerySuggestion = {
  /** What gets inserted. */
  value: string
  /** The type or note shown beside it: "₹ · after discounts". */
  detail: string
  type: QueryFieldType | 'table' | 'keyword' | 'word'
}

/** The word being typed at `cursor`, and where it starts. */
export function wordAt(source: string, cursor: number): { word: string; start: number } {
  let start = cursor
  while (start > 0 && /[\w-]/.test(source[start - 1] ?? '')) start--
  return { word: source.slice(start, cursor), start }
}

/** What fits at the cursor (Figma "Query autocomplete"), by the clause the cursor is in. */
export function suggest(source: string, cursor: number): QuerySuggestion[] {
  const { word, start } = wordAt(source, cursor)
  const before = tokenize(source.slice(0, start)).map((t) => t.upper)
  const fromAt = before.lastIndexOf('FROM')
  const table = QUERY_TABLE_NAMES.find((n) => n.toUpperCase() === before[fromAt + 1]) as
    | QueryTable
    | undefined
  const fields = table ? fieldsOf(table) : []
  const last = before.at(-1)
  const lastTwo = before.slice(-2).join(' ')
  const clause = [...before]
    .reverse()
    .find((w) => ['SHOW', 'BY', 'SINCE', 'UNTIL', 'TO', 'FROM', 'LIMIT'].includes(w))

  let options: QuerySuggestion[] = []
  if (last === 'FROM') {
    options = QUERY_TABLE_NAMES.map((n) => ({ value: n, detail: 'table', type: 'table' as const }))
  } else if (last === 'SHOW' || (clause === 'SHOW' && last === ',')) {
    options = fields
      .filter((f) => f.role === 'metric')
      .map((f) => ({ value: f.name, detail: f.description, type: f.type }))
  } else if (lastTwo === 'GROUP BY') {
    options = fields
      .filter((f) => f.role === 'dimension')
      .map((f) => ({ value: f.name, detail: f.description, type: f.type }))
  } else if (lastTwo === 'ORDER BY') {
    const shown = before.slice(before.indexOf('SHOW') + 1).filter((w) => w !== ',')
    options = fields
      .filter((f) => shown.includes(f.name.toUpperCase()))
      .map((f) => ({ value: f.name, detail: f.description, type: f.type }))
  } else if (lastTwo === 'COMPARE TO') {
    options = COMPARE_OPTIONS.map((o) => ({ value: o, detail: 'compare', type: 'word' as const }))
  } else if (last === 'SINCE' || last === 'UNTIL') {
    options = ['-7d', '-30d', '-90d', '-12m', ...TIME_WORDS].map((v) => ({
      value: v,
      detail: 'time',
      type: 'word' as const,
    }))
  } else if (table) {
    options = ['GROUP BY', 'SINCE', 'UNTIL', 'COMPARE TO', 'ORDER BY', 'LIMIT'].map((k) => ({
      value: k,
      detail: 'clause',
      type: 'keyword' as const,
    }))
  }
  const w = word.toLowerCase()
  return w ? options.filter((o) => o.value.toLowerCase().startsWith(w)) : options
}
