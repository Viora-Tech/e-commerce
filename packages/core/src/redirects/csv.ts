/**
 * SOURCE OF TRUTH: redirects CSV (import and export)
 * WHAT:  The file format Settings → Menus → URL redirects reads and writes: Shopify's own two
 *        columns, `Redirect from` and `Redirect to`, so a Shopify export imports as it is and
 *        ours opens in a spreadsheet. `parseRedirectsCsv` checks every row the way the dialog
 *        does (`RedirectWriteSchema`) and says what is wrong with each one by line number.
 * WHY:   Moving a store or renaming a range of products means hundreds of redirects; typing
 *        them one by one is not an option.
 * WHERE: API `redirects.exportCsv` / `redirects.importCsv`; `importRedirectsCsv` (service.ts)
 *        writes the parsed rows.
 */
import { RedirectWriteSchema } from './paths'

export const REDIRECT_CSV_HEADERS = ['Redirect from', 'Redirect to'] as const

/** Most rows one file may hold. */
export const REDIRECT_CSV_MAX_ROWS = 5000

export type ParsedRedirectRow = { line: number; path: string; target: string }
export type RedirectCsvProblem = { line: number; reason: string }

/** RFC 4180 quoting. Paths and URLs never start with a formula character, so none is escaped. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function redirectsToCsv(rows: readonly { path: string; target: string }[]): string {
  return [REDIRECT_CSV_HEADERS, ...rows.map((r) => [r.path, r.target])]
    .map((r) => r.map(cell).join(','))
    .join('\r\n')
}

/**
 * RFC 4180 rows with the file line each starts on (quoted fields may hold commas, newlines
 * and doubled quotes), so problems can name the line a spreadsheet shows.
 */
function csvRows(text: string): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = []
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let cells: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let start = 1
  const end = () => {
    cells.push(field)
    if (cells.some((c) => c.trim() !== '')) rows.push({ line: start, cells })
    cells = []
    field = ''
  }
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '"' && quoted && source[i + 1] === '"') {
      field += '"'
      i++
    } else if (ch === '"') {
      quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(field)
      field = ''
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++
      end()
      line++
      start = line
    } else {
      if (ch === '\n') line++
      field += ch
    }
  }
  if (field !== '' || cells.length > 0) end()
  return rows
}

const isHeader = (row: string[]) =>
  /redirect\s*from|^path$|^from$/i.test(row[0]?.trim() ?? '') &&
  /redirect\s*to|^target$|^to$/i.test(row[1]?.trim() ?? '')

/**
 * Rows to write and problems to show. The header row is optional; blank lines are skipped.
 * When the same "Redirect from" appears twice, the later row wins and the earlier is reported.
 */
export function parseRedirectsCsv(text: string): {
  rows: ParsedRedirectRow[]
  problems: RedirectCsvProblem[]
} {
  const table = csvRows(text)
  const problems: RedirectCsvProblem[] = []
  const byPath = new Map<string, ParsedRedirectRow>()
  const start = table[0] && isHeader(table[0].cells) ? 1 : 0
  let counted = 0
  for (let i = start; i < table.length; i++) {
    const { line, cells: row } = table[i] ?? { line: i + 1, cells: [] }
    if (row.every((c) => c.trim() === '')) continue
    counted++
    if (counted > REDIRECT_CSV_MAX_ROWS) {
      problems.push({ line, reason: `Only ${REDIRECT_CSV_MAX_ROWS} redirects fit in one file` })
      break
    }
    if (row.length < 2 || !row[1]?.trim()) {
      problems.push({ line, reason: 'Needs two columns: Redirect from, Redirect to' })
      continue
    }
    const parsed = RedirectWriteSchema.safeParse({ path: row[0] ?? '', target: row[1] })
    if (!parsed.success) {
      problems.push({ line, reason: parsed.error.issues[0]?.message ?? 'Not a valid redirect' })
      continue
    }
    const earlier = byPath.get(parsed.data.path)
    if (earlier) {
      problems.push({
        line: earlier.line,
        reason: `${parsed.data.path} appears again on line ${line}; that row is used`,
      })
    }
    byPath.set(parsed.data.path, { line, ...parsed.data })
  }
  const rows = [...byPath.values()].sort((a, b) => a.line - b.line)
  return { rows, problems: problems.sort((a, b) => a.line - b.line) }
}
