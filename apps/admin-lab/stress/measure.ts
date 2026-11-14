/**
 * SPIKE: Orders page timings, Next admin vs admin-lab, in headless Chromium (Playwright).
 *
 *   bun stress/measure.ts <cookie value> [runs] [mobile]
 *
 * For each app: a cold first visit (empty cache), a warm reload (HTTP cache), and an in-app
 * navigation away and back. "Data shown" = the first order row is in the table. JS/CSS sizes are
 * the bytes the browser fetched for the first visit, then gzip and brotli sizes of the same
 * bodies (the lab's static server does not compress; Next compresses with gzip).
 */
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { chromium, type Page } from 'playwright'

const cookie = process.argv[2]
const runs = Number(process.argv[3] ?? 5)
// `mobile`: a 390 px wide phone viewport and the CPU slowed 4x (DevTools "mid-tier mobile").
const mobile = process.argv[4] === 'mobile'
if (!cookie) throw new Error('usage: bun stress/measure.ts <session cookie> [runs]')

const APPS = [
  { name: 'next', origin: 'http://127.0.0.1:3200' },
  { name: 'lab', origin: 'http://127.0.0.1:3300' },
]
// A row link to an order detail: the same markup in both apps (ResourceTable).
const ROW = 'a[href^="/orders/0"]:not(.sr-only) >> visible=true'

type Asset = { url: string; type: string; raw: number; gz: number; br: number }

async function visit(page: Page, url: string) {
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'commit' })
  await page.waitForSelector(ROW, { timeout: 60_000 })
  const dataShown = Date.now() - t0
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    return {
      ttfb: n.responseStart,
      dcl: n.domContentLoadedEventEnd,
      load: n.loadEventEnd,
      fcp: fcp?.startTime ?? 0,
    }
  })
  return { dataShown, ...nav }
}

/** Time-to-interactive proxy: the end of the last main-thread long task (over 50 ms) after load. */
async function quietAt(page: Page): Promise<number> {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let last = 0
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) last = Math.max(last, e.startTime + e.duration)
        }).observe({ type: 'longtask', buffered: true })
        setTimeout(() => resolve(Math.round(last)), 50)
      }),
  )
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

const browser = await chromium.launch({ headless: true })
const results: Record<string, unknown> = {}
for (const app of APPS) {
  const cold: number[] = []
  const warm: number[] = []
  const back: number[] = []
  const ttfb: number[] = []
  const fcp: number[] = []
  const tti: number[] = []
  let assets: Asset[] = []
  let requests = 0
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext(
      mobile
        ? {
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
          }
        : { viewport: { width: 1440, height: 900 } },
    )
    await ctx.addCookies([
      { name: 'better-auth.session_token', value: cookie, domain: '127.0.0.1', path: '/' },
    ])
    const page = await ctx.newPage()
    if (mobile) {
      const cdp = await ctx.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    }
    const seen: Promise<Asset | null>[] = []
    let count = 0
    page.on('response', (res) => {
      count++
      const type = res.request().resourceType()
      if (i !== 0 || (type !== 'script' && type !== 'stylesheet')) return
      seen.push(
        res
          .body()
          .then((b) => ({
            url: res.url(),
            type,
            raw: b.length,
            gz: gzipSync(b, { level: 6 }).length,
            br: brotliCompressSync(b).length,
          }))
          .catch(() => null),
      )
    })
    const first = await visit(page, `${app.origin}/orders`)
    cold.push(first.dataShown)
    ttfb.push(first.ttfb)
    fcp.push(first.fcp)
    tti.push(await quietAt(page))
    if (i === 0) {
      await page.waitForLoadState('networkidle')
      assets = (await Promise.all(seen)).filter((a): a is Asset => a !== null)
      requests = count
    }
    // Warm reload: HTTP cache primed.
    const again = await visit(page, `${app.origin}/orders`)
    warm.push(again.dataShown)
    // In-app: open an order, then browser Back to the list.
    await page.locator(ROW).first().click()
    await page.waitForURL(/\/orders\/[^/?]+/, { timeout: 60_000 })
    await page.waitForTimeout(300)
    const t0 = Date.now()
    await page.goBack({ waitUntil: 'commit' })
    await page.waitForSelector(ROW, { timeout: 60_000 })
    back.push(Date.now() - t0)
    await ctx.close()
  }
  const js = assets.filter((a) => a.type === 'script')
  const css = assets.filter((a) => a.type === 'stylesheet')
  const sum = (xs: Asset[], k: 'raw' | 'gz' | 'br') =>
    Math.round(xs.reduce((s, a) => s + a[k], 0) / 1024)
  results[app.name] = {
    runs,
    coldDataShownMs: median(cold),
    warmReloadDataShownMs: median(warm),
    backToListMs: median(back),
    ttfbMs: Math.round(median(ttfb)),
    fcpMs: Math.round(median(fcp)),
    mainThreadQuietMs: median(tti),
    firstVisitRequests: requests,
    jsFiles: js.length,
    jsKiB: { raw: sum(js, 'raw'), gzip: sum(js, 'gz'), brotli: sum(js, 'br') },
    cssFiles: css.length,
    cssKiB: { raw: sum(css, 'raw'), gzip: sum(css, 'gz'), brotli: sum(css, 'br') },
    all: { cold, warm, back, tti },
  }
}
await browser.close()
console.log(JSON.stringify(results, null, 2))
