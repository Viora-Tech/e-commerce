/**
 * Markdown tables from `admin-pages.ts` CSVs: the slowest pages of one run, or a before/after
 * comparison of two.
 *
 *   bun scripts/perf/admin-pages-report.ts before.csv [--top 20]
 *   bun scripts/perf/admin-pages-report.ts before.csv after.csv [--only "regex"]
 *
 * "Slowest" ranks by doc (the whole streamed HTML: when the server finished every Suspense
 * boundary), the closest a dev-server run gets to "how long the server worked on this page".
 */
import { readFileSync } from 'node:fs'

type Row = Record<string, string>

const NEWLINE = String.fromCharCode(10)
const RETURN = String.fromCharCode(13)

/** RFC 4180 CSV: quoted cells may hold commas, quotes and line breaks. */
function parse(path: string): Row[] {
  const text = readFileSync(path, 'utf8').trim()
  const records: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === NEWLINE) {
      row.push(cur)
      records.push(row)
      row = []
      cur = ''
    } else if (ch !== RETURN) cur += ch
  }
  row.push(cur)
  records.push(row)
  const [cols = [], ...rest] = records
  return rest.map((cells) => Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ''])))
}

const argv = process.argv.slice(2)
const opt = (flag: string) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}
const files = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
const top = Number(opt('--top') ?? 20)
const only = opt('--only') ? new RegExp(opt('--only') as string) : null
const measured = (r: Row) => r.status === '200' && (!only || only.test(r.route ?? ''))

const [beforePath, afterPath] = files
if (!beforePath) throw new Error('usage: admin-pages-report.ts before.csv [after.csv]')
const before = parse(beforePath)

if (!afterPath) {
  const rows = before.filter(measured).sort((a, b) => Number(b.docMs) - Number(a.docMs))
  console.log('| # | Page | Server (doc) ms | Ready ms | DB statements | Queries | JS kB |')
  console.log('| ---: | --- | ---: | ---: | ---: | ---: | ---: |')
  rows.slice(0, top).forEach((r, i) => {
    console.log(
      `| ${i + 1} | \`${r.route}\` | ${r.docMs} | ${r.readyMs} | ${r.statements} | ${r.queries} | ${Math.round(Number(r.jsKb))} |`,
    )
  })
  const broken = before.filter((r) => r.status !== '200' || Number(r.errors) > 0)
  if (broken.length) {
    console.log(`${NEWLINE}Not measured, or with errors:${NEWLINE}`)
    for (const r of broken) {
      const why = (r.error ?? '').split(NEWLINE)[0]?.slice(0, 160)
      console.log(`- \`${r.route}\`: ${r.status || '-'} ${why}`)
    }
  }
} else {
  const after = new Map(parse(afterPath).map((r) => [r.route, r]))
  console.log('| Page | Server ms before → after | DB statements before → after |')
  console.log('| --- | ---: | ---: |')
  for (const b of before.filter(measured)) {
    const a = after.get(b.route ?? '')
    if (a?.status !== '200') continue
    console.log(`| \`${b.route}\` | ${b.docMs} → ${a.docMs} | ${b.statements} → ${a.statements} |`)
  }
}
