/**
 * Visit every admin page and record what it costs: server time, DB statements, JS and errors.
 *
 * Needs a local admin (`next dev` or `next start`) on a throwaway database that logs every
 * statement (`ALTER DATABASE <db> SET log_statement = 'all'` and
 * `ALTER SYSTEM SET log_line_prefix = '%m [%p] %a|%u '`), running in a Docker container
 * whose log this script reads. The owner account comes from `SEED_OWNER_EMAIL` (the seeded dev
 * owner) and signs in with the dev OTP route, so it never needs a real password.
 *
 *   bun run --env-file=.env scripts/perf/admin-pages.ts \
 *     --base http://localhost:3290 --container perf-admin-pg --out docs/research/x.csv \
 *     [--only "orders|analytics"] [--runs 2] [--append]
 *
 * Per page it writes one CSV row: the route, the URL visited, the HTTP status, TTFB (first
 * byte of the HTML), doc (the whole streamed HTML, i.e. when the server finished every
 * Suspense boundary), ready (no skeleton left in <main> and the network quiet), the DB
 * statements logged while the page loaded (all, and without BEGIN/COMMIT/set_config), the
 * script bytes the page loaded (encoded body size, so cached files count too) and any errors. With --runs N it keeps the fastest run.
 * Each page is loaded once first to compile it (dev) and warm caches; that load is not counted.
 */
import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { freemem, tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { createDb } from '@commerce/db'
import { chromium } from 'playwright'

const argv = process.argv.slice(2)
const opt = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? (argv[i + 1] ?? fallback) : fallback
}
const BASE = opt('--base', 'http://localhost:3200')
const CONTAINER = opt('--container', 'perf-admin-pg')
const OUT = opt('--out', 'docs/research/admin-pages-perf.csv')
// `PERF_ONLY` too: the chunked runner passes it that way, since on Windows a `|` in an argument
// would go through cmd.exe as a pipe.
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a local dev script, not a turbo task
const onlyPattern = argv.includes('--only') ? opt('--only', '.') : process.env.PERF_ONLY
const ONLY = onlyPattern ? new RegExp(onlyPattern) : null
const RUNS = Number(opt('--runs', '1'))
const APPEND = argv.includes('--append')
/** Stop after this many pages (a dev server grows with every route it compiles; restart it). */
const MAX = Number(opt('--max', '100000'))
/** Leave out routes already in --out (resume a chunked run). */
const SKIP_DONE = argv.includes('--skip-done')
/** End a chunk early below this much free memory (MB). */
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a local dev script, not a turbo task
const MIN_FREE_MB = Number(process.env.PERF_MIN_FREE_MB ?? '1500')
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a local dev script, not a turbo task
const EMAIL = process.env.SEED_OWNER_EMAIL
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a local dev script, not a turbo task
const OWNER_URL = process.env.DATABASE_URL_OWNER
if (!EMAIL || !OWNER_URL) throw new Error('SEED_OWNER_EMAIL and DATABASE_URL_OWNER are required')
if (!/localhost|127\.0\.0\.1/.test(OWNER_URL)) throw new Error('refusing: database is not local')

const APP_DIR = 'apps/admin/src/app'

/** Every page route under the admin app, as a URL pattern (`/orders/[id]`), groups removed. */
function routes(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name === 'page.tsx') {
        const rel = relative(APP_DIR, dir).replaceAll('\\', '/')
        const route = `/${rel
          .split('/')
          .filter((s) => s && !/^\(.*\)$/.test(s))
          .join('/')}`
        out.push(route)
      }
    }
  }
  walk(APP_DIR)
  return [...new Set(out)].sort()
}

const db = createDb(OWNER_URL, { max: 1 })
const sql = db.$client
await sql`set application_name = 'perfmark'`

async function first(query: string): Promise<string | null> {
  try {
    const rows = await sql.unsafe(query)
    const v = rows[0] ? Object.values(rows[0])[0] : null
    return v == null ? null : String(v)
  } catch {
    return null
  }
}

/** Values for dynamic segments, from the seeded store. `null` = no row to open (skipped). */
async function resolve(route: string): Promise<string | null> {
  const ids: Record<string, string> = {
    '/orders/[id]': `select id from "order" where draft_number is null order by placed_at desc limit 1`,
    '/orders/[id]/edit': `select id from "order" where draft_number is null and status = 'open' order by placed_at desc limit 1`,
    '/orders/[id]/ship': `select id from "order" where draft_number is null and status = 'open' and payment_status = 'paid' order by placed_at desc limit 1`,
    '/orders/drafts/[id]': `select id from "order" where draft_number is not null limit 1`,
    '/orders/abandoned-checkouts/[id]': `select id from cart order by updated_at desc limit 1`,
    '/orders/returns/[id]': `select id from return_request limit 1`,
    '/orders/shipments/[id]': `select id from shipment limit 1`,
    '/products/[id]': `select product_id from variant group by product_id order by count(*) desc limit 1`,
    '/products/collections/[id]': `select collection_id from collection_product group by 1 order by count(*) desc limit 1`,
    '/products/gift-cards/[id]': `select id from gift_card limit 1`,
    '/products/preorders/campaigns/[id]': `select id from preorder_campaign limit 1`,
    '/customers/[id]': `select customer_id from "order" where customer_id is not null group by 1 order by count(*) desc limit 1`,
    '/customers/segments/[id]': `select id from customer_segment limit 1`,
    '/discounts/[id]': `select id from discount limit 1`,
    '/content/blog-posts/[id]': `select id from article limit 1`,
    '/content/files/[id]': `select id from media limit 1`,
    '/content/menus/[id]': `select id from navigation_menu limit 1`,
    '/content/metaobjects/[type]': `select type from metaobject_definition limit 1`,
    '/content/metaobjects/[type]/[id]': `select d.type || '/' || m.id from metaobject m join metaobject_definition d on d.id = m.definition_id limit 1`,
    '/content/metaobjects/[type]/definition': `select type from metaobject_definition limit 1`,
    '/content/metaobjects/[type]/new': `select type from metaobject_definition limit 1`,
    '/growth/automations/[id]': `select id from marketing_automation limit 1`,
    '/growth/campaigns/[id]': `select id from marketing_campaign limit 1`,
    '/markets/[id]': `select id from market limit 1`,
    '/markets/catalogs/[id]': `select id from catalog limit 1`,
    '/markets/rollouts/[id]': `select id from rollout limit 1`,
    '/online-store/pages/[id]': `select id from page limit 1`,
    '/online-store/pages/[id]/content': `select id from page limit 1`,
    '/online-store/themes/[id]/import': `select id from theme limit 1`,
    '/online-store/themes/[id]/code': `select theme_id from theme_file group by 1 order by count(*) desc limit 1`,
    '/online-store/themes/[id]/editor': `select id from theme order by (role = 'live') desc limit 1`,
    '/settings/domains/[id]': `select id from store_domain limit 1`,
    '/settings/locations/[id]': `select id from location limit 1`,
    '/settings/privacy/requests/[id]': `select id from data_request limit 1`,
    '/settings/shipping/profiles/[id]': `select id from shipping_profile limit 1`,
    '/settings/shipping/zones/[id]': `select id from shipping_zone limit 1`,
    '/settings/staff/roles/[id]': `select id from role limit 1`,
    '/stock/inbound-shipments/[id]': `select id from inbound_shipment limit 1`,
    '/stock/purchase-orders/[id]': `select id from purchase_order limit 1`,
    '/stock/suppliers/[id]': `select id from supplier limit 1`,
    '/stock/transfers/[id]': `select id from transfer limit 1`,
    '/platform/stores/[id]': `select id from store limit 1`,
  }
  const literal: Record<string, string> = {
    '/analytics/reports/[slug]': '/analytics/reports/sales-over-time',
    '/apps/[pluginId]/[[...path]]': '/apps/reviews',
    '/dev/emails/[template]': '/dev/emails/order_confirmation',
    '/sales-channels/social/[channel]': '/sales-channels/social/google',
    '/settings/custom-data/[owner]': '/settings/custom-data/products',
    '/settings/payments/providers/[id]': '/settings/payments/providers/razorpay',
    '/settings/policies/[type]': '/settings/policies/refund-policy',
    '/settings/templates/[kind]': '/settings/templates/packing_slip',
    '/[...missing]': '/this-page-does-not-exist',
  }
  if (literal[route]) return literal[route]
  if (!route.includes('[')) return route
  const q = ids[route]
  if (!q) return null
  const v = await first(q)
  if (!v) return null
  if (route === '/content/metaobjects/[type]/[id]') return `/content/metaobjects/${v}`
  return route.replace(/\[[^\]]+\]/, v)
}

const MARK = (tag: string) => `perfmark:${tag}:${Date.now()}:${Math.random().toString(36).slice(2)}`

/** Statements the server ran between two marker queries, from the container log. */
function parseLog(log: string, start: string, end: string) {
  const lines = log.split('\n')
  let inside = false
  let all = 0
  let tx = 0
  let setConfig = 0
  for (const line of lines) {
    if (line.includes(start)) {
      inside = true
      continue
    }
    if (line.includes(end)) break
    if (!inside) continue
    const m =
      /^\d{4}-\d\d-\d\d [\d:.]+ \w+ \[\d+\] ([^|]*)\|\S* LOG: {2}(?:statement|execute [^:]*): (.*)$/.exec(
        line,
      )
    if (!m || m[1] === 'perfmark') continue
    all++
    const text = (m[2] ?? '').trim().toLowerCase()
    if (/^(begin|commit|rollback|start transaction)\b/.test(text)) tx++
    else if (text.startsWith('select set_config(')) setConfig++
  }
  return { all, queries: all - tx - setConfig, tx, setConfig }
}

function dockerLogsBoth(since: string): string {
  // Postgres logs to stderr; keep both streams.
  const r = spawnSync('docker', ['logs', '--since', since, CONTAINER], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  return `${r.stdout ?? ''}${r.stderr ?? ''}`
}

/** The session cookie, kept in the OS temp folder between runs: sign-in codes are rate limited. */
const COOKIE_FILE = join(tmpdir(), 'koomerce-perf-admin-session.txt')

async function signIn(): Promise<string> {
  if (existsSync(COOKIE_FILE)) {
    const saved = readFileSync(COOKIE_FILE, 'utf8').trim()
    const res = await fetch(`${BASE}/api/auth/get-session`, { headers: { cookie: saved } })
    if (res.ok && (await res.text()).includes(EMAIL ?? '')) return saved
  }
  const fresh = await signInWithCode()
  writeFileSync(COOKIE_FILE, fresh)
  return fresh
}

async function signInWithCode(): Promise<string> {
  const headers = { 'content-type': 'application/json', origin: BASE }
  const sent = await fetch(`${BASE}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: EMAIL, type: 'sign-in' }),
  })
  if (!sent.ok) throw new Error(`send otp: ${sent.status}`)
  const { otp } = (await (await fetch(`${BASE}/api/dev/otp?email=${EMAIL}`)).json()) as {
    otp: string
  }
  const res = await fetch(`${BASE}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: EMAIL, otp }),
    redirect: 'manual',
  })
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0])
  if (!res.ok || cookies.length === 0) throw new Error(`sign in: ${res.status}`)
  return cookies.join('; ')
}

type Row = {
  route: string
  url: string
  status: number
  ttfbMs: number
  docMs: number
  readyMs: number
  statements: number
  queries: number
  txStatements: number
  setConfig: number
  jsKb: number
  jsFiles: number
  errors: number
  error: string
}
const COLS: (keyof Row)[] = [
  'route',
  'url',
  'status',
  'ttfbMs',
  'docMs',
  'readyMs',
  'statements',
  'queries',
  'txStatements',
  'setConfig',
  'jsKb',
  'jsFiles',
  'errors',
  'error',
]
const csv = (v: unknown) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

const cookie = await signIn()
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } })
const url0 = new URL(BASE)
await context.addCookies(
  cookie.split('; ').map((c) => {
    const [name, ...v] = c.split('=')
    return { name: name ?? '', value: v.join('='), domain: url0.hostname, path: '/' }
  }),
)

if (!APPEND || !existsSync(OUT)) writeFileSync(OUT, `${COLS.join(',')}\n`)
const done = new Set(
  SKIP_DONE
    ? readFileSync(OUT, 'utf8')
        .split('\n')
        .slice(1)
        .map((l) => l.split(',')[0])
    : [],
)

async function measure(path: string): Promise<Omit<Row, 'route' | 'url'>> {
  const page = await context.newPage()
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 500) errs.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  const since = new Date(Date.now() - 2000).toISOString()
  const start = MARK('start')
  await sql.unsafe(`select '${start}'`)
  let status = 0
  try {
    const res = await page.goto(path, { waitUntil: 'load', timeout: 120_000 })
    status = res?.status() ?? 0
    await page
      .waitForFunction(() => !document.querySelector('main [data-slot="skeleton"]'), null, {
        timeout: 20_000,
      })
      .catch(() => errs.push('skeleton still showing after 20 s'))
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  } catch (e) {
    errs.push(`goto: ${(e as Error).message.split('\n')[0]}`)
  }
  const timing = await page
    .evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const js = res.filter((r) => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name))
      const lastEnd = Math.max(nav?.responseEnd ?? 0, ...res.map((r) => r.responseEnd))
      return {
        ttfb: nav ? nav.responseStart - nav.requestStart : 0,
        doc: nav ? nav.responseEnd - nav.requestStart : 0,
        ready: lastEnd - (nav?.requestStart ?? 0),
        jsBytes: js.reduce((s, r) => s + (r.encodedBodySize || r.transferSize || 0), 0),
        jsFiles: js.length,
      }
    })
    .catch(() => ({ ttfb: 0, doc: 0, ready: 0, jsBytes: 0, jsFiles: 0 }))
  await new Promise((r) => setTimeout(r, 300))
  const end = MARK('end')
  await sql.unsafe(`select '${end}'`)
  await new Promise((r) => setTimeout(r, 200))
  const counts = parseLog(dockerLogsBoth(since), start, end)
  await page.close()
  return {
    status,
    ttfbMs: Math.round(timing.ttfb),
    docMs: Math.round(timing.doc),
    readyMs: Math.round(timing.ready),
    statements: counts.all,
    queries: counts.queries,
    txStatements: counts.tx,
    setConfig: counts.setConfig,
    jsKb: Math.round(timing.jsBytes / 102.4) / 10,
    jsFiles: timing.jsFiles,
    errors: errs.length,
    error: errs.slice(0, 3).join(' | ').slice(0, 300),
  }
}

const all = routes().filter((r) => (!ONLY || ONLY.test(r)) && !done.has(r))
console.log(`${all.length} routes to go`)
let visited = 0
for (const route of all) {
  if (visited >= MAX) break
  // A dev server grows with each page it compiles; end the chunk early so the runner restarts it.
  // A dev server grows by ~0.5 GB a page; a production build does not, so `PERF_MIN_FREE_MB`
  // can lower this guard for `next start` runs.
  if (visited > 0 && freemem() < MIN_FREE_MB * 1024 * 1024) {
    console.log('low memory: ending this chunk early')
    break
  }
  visited++
  // Sign-in, OAuth and invitation pages need a signed-out visitor or a token; skip them.
  if (/^\/(login|oauth|accept-invitation|onboarding)/.test(route)) continue
  const path = await resolve(route)
  if (!path) {
    appendFileSync(
      OUT,
      `${COLS.map((c) => csv(c === 'route' ? route : c === 'error' ? 'skipped: no row to open' : '')).join(',')}\n`,
    )
    console.log(`skip ${route}`)
    continue
  }
  // Compile (dev) and warm caches; not counted.
  const warm = await context.newPage()
  await warm.goto(path, { waitUntil: 'load', timeout: 300_000 }).catch(() => {})
  await warm.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await warm.close()
  let best: Omit<Row, 'route' | 'url'> | null = null
  for (let i = 0; i < RUNS; i++) {
    const r = await measure(path)
    if (!best || r.docMs < best.docMs) best = r
  }
  if (!best) continue
  const row: Row = { route, url: path, ...best }
  appendFileSync(OUT, `${COLS.map((c) => csv(row[c])).join(',')}\n`)
  console.log(
    `${route}  ${row.status}  doc ${row.docMs} ms  ready ${row.readyMs} ms  ${row.statements} stmts  ${row.errors} err`,
  )
}

if (visited === all.length) console.log('ALL ROUTES DONE')
await browser.close()
await sql.end()
