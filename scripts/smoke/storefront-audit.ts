/**
 * Storefront page audit: opens each page on a desktop (1366) and a phone (390) viewport and
 * records what a reviewer checks by hand: status, TTFB and LCP, console errors, failed requests,
 * broken images, horizontal scroll on the phone, the SEO tags (title, description, canonical,
 * JSON-LD) and accessibility basics (image alt, unlabelled fields and buttons, h1 count).
 * It only reads pages: no forms are submitted and nothing is added to the cart.
 *
 * Usage (runs on Node, like the checkout smoke):
 *   node --no-warnings scripts/smoke/storefront-audit.ts --base https://waimers.koomerce.app
 *   node --no-warnings scripts/smoke/storefront-audit.ts --base https://waimers.in --paths /,/cart
 * Default paths: home, a collection, two products, search, cart, login, policies, 404s.
 * Writes `audit.json` and a screenshot per page and viewport into a temp folder it prints.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type BrowserContextOptions, chromium, devices, type Page } from 'playwright'

type Viewport = 'desktop' | 'phone'

type PageReport = {
  viewport: Viewport
  path: string
  status: number | null
  ttfbMs: number | null
  lcpMs: number | null
  loadMs: number
  consoleErrors: string[]
  failedRequests: string[]
  brokenImages: string[]
  overflowPx: number
  overflowing: string[]
  title: string
  description: string | null
  canonical: string | null
  robots: string | null
  jsonLd: string[]
  h1: string[]
  imagesWithoutAlt: number
  unlabelledFields: string[]
  unnamedButtons: number
  unnamedLinks: number
  shot: string
}

const CONTEXTS: Record<Viewport, BrowserContextOptions> = {
  desktop: { viewport: { width: 1366, height: 900 } },
  phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
}
const DEFAULT_PATHS = [
  '/',
  '/collections/all',
  '/search?q=mouse',
  '/search?q=zzqxv',
  '/cart',
  '/account/login',
  '/policies/privacy-policy',
  '/policies/refund-policy',
  '/policies/shipping-policy',
  '/policies/terms-of-service',
  '/pages/contact',
  '/does-not-exist',
  '/products/does-not-exist',
]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

function oneLine(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

async function inspect(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const width = doc.clientWidth
    const overflowing = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.right > width + 1 && getComputedStyle(el).position !== 'fixed'
      })
      .filter((el) => !el.closest('[aria-hidden="true"], [hidden], dialog:not([open])'))
      .slice(0, 8)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')}`,
      )
    const meta = (name: string) =>
      document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null
    const labelled = (el: Element) => {
      const input = el as HTMLInputElement
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') return true
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true
      if (el.closest('label')) return true
      return Boolean(input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`))
    }
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null
    const accessibleText = (el: Element) =>
      (el.textContent ?? '').trim() ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.querySelector('img[alt]:not([alt=""]), svg title')?.textContent ||
      el.querySelector('img[alt]')?.getAttribute('alt')
    return {
      overflowPx: doc.scrollWidth - width,
      overflowing,
      title: document.title,
      description: meta('description'),
      robots: meta('robots'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
        try {
          const data = JSON.parse(s.textContent ?? '')
          const items = Array.isArray(data) ? data : (data['@graph'] ?? [data])
          return items.map((i: { '@type'?: string }) => String(i['@type']))
        } catch {
          return ['invalid JSON']
        }
      }),
      h1: [...document.querySelectorAll('h1')]
        .filter(visible)
        .map((h) => (h.textContent ?? '').trim()),
      brokenImages: [...document.images]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
        .map((i) => i.currentSrc)
        .slice(0, 10),
      imagesWithoutAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
      unlabelledFields: [...document.querySelectorAll('input, select, textarea')]
        .filter(visible)
        .filter((el) => !labelled(el))
        .map((el) => `${el.tagName.toLowerCase()}[name=${el.getAttribute('name')}]`),
      unnamedButtons: [...document.querySelectorAll('button')]
        .filter(visible)
        .filter((b) => !accessibleText(b)).length,
      unnamedLinks: [...document.querySelectorAll('a[href]')]
        .filter(visible)
        .filter((a) => !accessibleText(a)).length,
    }
  })
}

async function audit(page: Page, base: string, path: string, viewport: Viewport, outDir: string) {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === 'error') consoleErrors.push(oneLine(m.text()))
  }
  const onError = (e: Error) => consoleErrors.push(`pageerror: ${oneLine(e.message)}`)
  const onResponse = (r: { status(): number; url(): string }) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 160)}`)
  }
  const onFailed = (r: { url(): string; failure(): { errorText: string } | null }) => {
    const reason = r.failure()?.errorText ?? 'failed'
    if (!reason.includes('ABORTED')) failedRequests.push(`${reason} ${r.url().slice(0, 160)}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onError)
  page.on('response', onResponse)
  page.on('requestfailed', onFailed)
  const started = Date.now()
  const response = await page
    .goto(`${base}${path}`, { waitUntil: 'load', timeout: 45_000 })
    .catch(() => null)
  await page.waitForTimeout(2_500)
  const loadMs = Date.now() - started
  const timing = await page.evaluate(
    () =>
      new Promise<{ ttfb: number | null; lcp: number | null }>((resolve) => {
        const nav = performance.getEntriesByType('navigation')[0] as
          | PerformanceNavigationTiming
          | undefined
        let lcp: number | null = null
        try {
          new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1)
            if (last) lcp = last.startTime
          }).observe({ type: 'largest-contentful-paint', buffered: true })
        } catch {}
        setTimeout(() => resolve({ ttfb: nav ? nav.responseStart : null, lcp }), 300)
      }),
  )
  const details = await inspect(page)
  const shot = join(
    outDir,
    `${viewport}-${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}.jpg`,
  )
  await page
    .screenshot({ path: shot, fullPage: true, type: 'jpeg', quality: 55 })
    .catch(() => undefined)
  page.off('console', onConsole)
  page.off('pageerror', onError)
  page.off('response', onResponse)
  page.off('requestfailed', onFailed)
  const report: PageReport = {
    viewport,
    path,
    status: response?.status() ?? null,
    ttfbMs: timing.ttfb === null ? null : Math.round(timing.ttfb),
    lcpMs: timing.lcp === null ? null : Math.round(timing.lcp),
    loadMs,
    consoleErrors: [...new Set(consoleErrors)],
    failedRequests: [...new Set(failedRequests)],
    shot,
    ...details,
  }
  return report
}

const base = (arg('base') ?? 'https://waimers.koomerce.app').replace(/\/+$/, '')
const paths = arg('paths')?.split(',') ?? DEFAULT_PATHS
const outDir =
  arg('out') ?? join(tmpdir(), `koomerce-audit-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const reports: PageReport[] = []
for (const viewport of ['desktop', 'phone'] as const) {
  const context = await browser.newContext(CONTEXTS[viewport])
  const page = await context.newPage()
  for (const path of paths) {
    const report = await audit(page, base, path, viewport, outDir)
    reports.push(report)
    console.log(
      `${viewport.padEnd(7)} ${String(report.status).padEnd(4)} ttfb ${report.ttfbMs}ms lcp ${report.lcpMs}ms ` +
        `err ${report.consoleErrors.length} 4xx ${report.failedRequests.length} ` +
        `img ${report.brokenImages.length} overflow ${report.overflowPx}px  ${path}`,
    )
  }
  await context.close()
}
await browser.close()
writeFileSync(join(outDir, 'audit.json'), JSON.stringify(reports, null, 2))
console.log(`\nReport and screenshots: ${outDir}`)
