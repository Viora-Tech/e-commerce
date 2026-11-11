/**
 * HTML match check for the storefront pilot (docs/research/2026-11-storefront-hono-pilot.md):
 * the same product URLs from the Next storefront (A) and the Hono pilot (B), compared after
 * normalising what differs on every request (nonces, Next build ids and chunk names, the RSC
 * payload). Only one server runs at a time on the dev PC, so it works in two steps:
 *
 *   bun scripts/html-match.ts fetch http://localhost:3100 out/a handles.txt
 *   bun scripts/html-match.ts fetch http://localhost:3200 out/b handles.txt
 *   bun scripts/html-match.ts diff out/a out/b [report.json]
 *
 * The diff reports, per URL: the status codes; each theme section (`shopify-section-*`), our
 * product section (`<div class="shopify-section">`), the head's SEO tags and the JSON-LD, each
 * equal or not; and the whole document after normalising, equal or not.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Fetched = { handle: string; status: number; html: string }

const fileOf = (handle: string) => `${handle.replace(/[^a-z0-9_-]/gi, '_')}.json`

async function fetchAll(base: string, out: string, handlesFile: string) {
  mkdirSync(out, { recursive: true })
  const handles = readFileSync(handlesFile, 'utf8')
    .split(/\r?\n/)
    .map((h) => h.trim())
    .filter(Boolean)
  for (const handle of handles) {
    const res = await fetch(`${base}/products/${encodeURIComponent(handle)}`, {
      headers: { host: new URL(base).host, accept: 'text/html' },
      redirect: 'manual',
    })
    const html = await res.text()
    const row: Fetched = { handle, status: res.status, html }
    writeFileSync(join(out, fileOf(handle)), JSON.stringify(row))
    console.log(res.status, handle, html.length)
  }
}

/** What changes on every request or every build, not with the page. */
function normalise(html: string): string {
  return (
    html
      .replace(/ nonce="[^"]*"/g, '')
      // The two servers listen on different ports of the same host.
      .replace(/localhost:\d+/g, 'localhost:PORT')
      // Next's per-request slot ids (`LiquidHtml` keeps section markup out of the RSC payload).
      .replace(/ data-liquid-slot="[^"]*"/g, '')
      // Image preloads: Next hoists them into <head>, `renderToString` leaves them in place.
      .replace(/<link rel="preload" as="image"[^>]*>/g, '')
      // Next's runtime: its chunks, the RSC payload pushes and preloads of its own files.
      .replace(/<script[^>]*src="\/_next\/[^"]*"[^>]*><\/script>/g, '')
      .replace(/<script>\(self\.__next_f=self\.__next_f\|\|\[\]\)\.push\([\s\S]*?\)<\/script>/g, '')
      .replace(/<script>self\.__next_f\.push\([\s\S]*?\)<\/script>/g, '')
      .replace(/<link[^>]*href="\/_next\/[^"]*"[^>]*\/?>/g, '')
      .replace(/\/_next\/static\/[A-Za-z0-9_-]{10,}\//g, '/_next/static/BUILD/')
      // React's text separators and Suspense markers.
      .replace(/<!-- -->/g, '')
      .replace(/<!--\/?\$[!?]?-->/g, '')
      .replace(/<template[^>]*><\/template>/g, '')
      // Self-closing void tags as React writes them versus as typed.
      .replace(/\s*\/>/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** The element whose opening tag starts at `start`, through its matching close tag. */
function elementAt(html: string, start: number): string | null {
  const tag = /^<([a-zA-Z0-9-]+)/.exec(html.slice(start))?.[1]
  if (!tag) return null
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi')
  re.lastIndex = start
  let depth = 0
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] === '/') depth--
    else if (!m[0].endsWith('/>')) depth++
    if (depth === 0) return html.slice(start, m.index + m[0].length)
  }
  return null
}

/** Each theme section by id, and our product section. */
function sections(html: string): Map<string, string> {
  const out = new Map<string, string>()
  const re = /<([a-z]+)[^>]*\bid="(shopify-section-[^"]+)"/g
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const el = elementAt(html, m.index)
    if (el) out.set(m[2] as string, el)
  }
  const ours = html.indexOf('<div class="shopify-section">')
  if (ours >= 0) {
    const el = elementAt(html, ours)
    if (el) out.set('MainProduct', el)
  }
  return out
}

/** The head tags shoppers and search engines read. */
function seoTags(html: string): Record<string, string> {
  const pick = (re: RegExp) => [...html.matchAll(re)].map((m) => m[1] ?? '').join(' || ')
  return {
    title: pick(/<title>([^<]*)<\/title>/g),
    description: pick(/<meta name="description" content="([^"]*)"/g),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/g),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/g),
    ogImage: pick(/<meta property="og:image" content="([^"]*)"/g),
    jsonLd: pick(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  }
}

function firstDiff(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return `at ${i}: A «${a.slice(Math.max(0, i - 60), i + 120)}» B «${b.slice(Math.max(0, i - 60), i + 120)}»`
}

function diff(dirA: string, dirB: string, reportFile?: string) {
  const handlesA = readFileSync(join(dirA, '_handles.txt'), 'utf8').split('\n').filter(Boolean)
  let pages = 0
  let fullEqual = 0
  let sectionsTotal = 0
  let sectionsEqual = 0
  let seoEqual = 0
  const byPart = new Map<string, { equal: number; total: number; sample?: string }>()
  const statusMismatch: string[] = []
  for (const handle of handlesA) {
    const a = JSON.parse(readFileSync(join(dirA, fileOf(handle)), 'utf8')) as Fetched
    const b = JSON.parse(readFileSync(join(dirB, fileOf(handle)), 'utf8')) as Fetched
    if (a.status !== b.status) {
      statusMismatch.push(`${handle}: A ${a.status} B ${b.status}`)
      continue
    }
    if (a.status !== 200) continue
    pages++
    const na = normalise(a.html)
    const nb = normalise(b.html)
    if (na === nb) fullEqual++
    const sa = sections(na)
    const sb = sections(nb)
    for (const id of new Set([...sa.keys(), ...sb.keys()])) {
      const part = id.replace(/^shopify-section-(template|sections)--\d+__/, '')
      const row = byPart.get(part) ?? { equal: 0, total: 0 }
      row.total++
      sectionsTotal++
      const x = sa.get(id) ?? ''
      const y = sb.get(id) ?? ''
      if (x === y) {
        row.equal++
        sectionsEqual++
      } else if (!row.sample) {
        row.sample = !x ? 'missing in A' : !y ? 'missing in B' : firstDiff(x, y)
      }
      byPart.set(part, row)
    }
    const ta = seoTags(na)
    const tb = seoTags(nb)
    if (JSON.stringify(ta) === JSON.stringify(tb)) seoEqual++
    else {
      const row = byPart.get('(head SEO tags, differing pages)') ?? { equal: 0, total: 0 }
      row.total++
      for (const k of Object.keys(ta)) {
        const x = ta[k] ?? ''
        const y = tb[k] ?? ''
        if (x !== y && !row.sample)
          row.sample = `${k}: A «${x.slice(0, 200)}» B «${y.slice(0, 200)}»`
      }
      byPart.set('(head SEO tags, differing pages)', row)
    }
  }
  const report = {
    pages,
    statusMismatch,
    wholeDocumentEqual: fullEqual,
    sections: { equal: sectionsEqual, total: sectionsTotal },
    headSeoEqual: seoEqual,
    byPart: Object.fromEntries(byPart),
  }
  console.log(JSON.stringify(report, null, 2))
  if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2))
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'fetch') {
  const [base, out, handles] = args
  if (!base || !out || !handles) throw new Error('fetch <base> <outDir> <handles.txt>')
  await fetchAll(base, out, handles)
  writeFileSync(join(out, '_handles.txt'), readFileSync(handles, 'utf8').replace(/\r/g, ''))
} else if (cmd === 'diff') {
  const [a, b, report] = args
  if (!a || !b) throw new Error('diff <dirA> <dirB> [report.json]')
  diff(a, b, report)
} else {
  console.log(
    'usage: html-match.ts fetch <base> <outDir> <handles.txt> | diff <dirA> <dirB> [report.json]',
  )
}
