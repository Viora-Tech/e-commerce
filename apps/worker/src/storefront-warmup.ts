/** SOURCE OF TRUTH: storefront warm-up — WHAT: after a storefront process starts (a deploy), loads each live store's front pages once so the first shoppers do not pay for cold code / WHY: first renders after a deploy took 4–12 s (13 Nov 2026) */
import { siteConfig } from '@commerce/config/site'
import { type Db, listenStorefrontCache, liveStorefrontHosts } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/** The new process announces itself while it boots; give it time to start listening. */
const START_DELAY_MS = 15_000
/** One page render; a cold one has taken 12 s. */
const PAGE_TIMEOUT_MS = 30_000
/** The pages a shopper most often lands on, in order. */
export const WARM_PATHS = ['/', '/collections/all'] as const

/** The URLs to load, store by store. A query string skips any edge copy, so the origin renders. */
export function warmupUrls(hosts: readonly string[], stamp: number): string[] {
  return hosts.flatMap((h) => WARM_PATHS.map((p) => `https://${h}${p}?warmup=${stamp}`))
}

/** Load every URL one after another (never in parallel: a cold 2-CPU server would only slow down). */
export async function warmPages(
  urls: readonly string[],
  fetcher: typeof fetch = fetch,
): Promise<{ ok: number; failed: number; ms: number }> {
  const started = Date.now()
  let ok = 0
  let failed = 0
  for (const url of urls) {
    try {
      const res = await fetcher(url, {
        headers: { 'user-agent': `${siteConfig.brand.name}Warmup/1.0`, accept: 'text/html' },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      })
      await res.arrayBuffer()
      if (res.ok) ok++
      else failed++
    } catch {
      failed++
    }
  }
  return { ok, failed, ms: Date.now() - started }
}

/**
 * Listens for storefront starts on the `storefront_cache` channel and warms the live stores'
 * front pages once per start (a second start within the window reuses the same run).
 */
export function startStorefrontWarmup(db: Db, listenUrl: string): { close: () => Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const run = async () => {
    timer = null
    try {
      const hosts = await liveStorefrontHosts(db)
      const result = await warmPages(warmupUrls(hosts, Date.now()))
      logger.info('storefront warmed', { area: 'warmup', hosts: hosts.length, ...result })
    } catch (err) {
      logger.warn('storefront warm-up failed', { area: 'warmup', error: err })
    }
  }
  const listener = listenStorefrontCache(listenUrl, {
    onChange: () => undefined,
    onLive: () => undefined,
    onLost: () => undefined,
    onStorefrontStart: () => {
      if (timer) return
      timer = setTimeout(() => void run(), START_DELAY_MS)
      timer.unref?.()
    },
  })
  return {
    close: async () => {
      if (timer) clearTimeout(timer)
      await listener.close()
    },
  }
}
