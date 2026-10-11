import 'server-only'
import { request } from 'node:http'
import { type PageVisit, pagesToWarm, WARM_USER_AGENT } from './recent-pages'

/**
 * Re-renders a store's recently viewed pages right after the store changes, so the next shopper
 * (and the merchant checking their edit) gets a cached page instead of paying for the render.
 *
 * `proxy.ts` notes page views (`recent-pages.ts`); the render cache's listener (`store-cache.ts`)
 * calls `scheduleWarm` when a store's data changes. Warming waits until the store has been quiet
 * for a few seconds (an import writes for minutes; nothing is warmed until it stops), then
 * fetches each page once, one at a time, from this same server, as a visitor without cookies.
 */

/** Quiet time after the last change before warming starts. */
export const WARM_QUIET_MS = 3_000
/** One page fetch never holds the warmer longer than this. */
const FETCH_TIMEOUT_MS = 20_000

type WarmState = { timers: Map<string, ReturnType<typeof setTimeout>>; running: Set<string> }

const g = globalThis as unknown as { __storefrontWarm?: WarmState }

function state(): WarmState {
  g.__storefrontWarm ??= { timers: new Map(), running: new Set() }
  return g.__storefrontWarm
}

/**
 * Warms the store's pages once it has been quiet for `delayMs`. A later change pushes the start
 * back, unless `restart` is false (a warm already due by then is enough).
 */
export function scheduleWarm(storeId: string, delayMs = WARM_QUIET_MS, restart = true): void {
  const s = state()
  const pending = s.timers.get(storeId)
  if (pending && !restart) return
  if (pending) clearTimeout(pending)
  const timer = setTimeout(() => {
    s.timers.delete(storeId)
    void warm(storeId)
  }, delayMs)
  timer.unref?.()
  s.timers.set(storeId, timer)
}

async function warm(storeId: string): Promise<void> {
  const s = state()
  // A warm already running finishes first; the next one starts after it.
  if (s.running.has(storeId)) return scheduleWarm(storeId)
  s.running.add(storeId)
  try {
    for (const page of pagesToWarm(storeId)) await fetchPage(page)
  } finally {
    s.running.delete(storeId)
  }
}

/** GETs one page from this server, as its own host would, and reads the answer to the end. */
function fetchPage(page: PageVisit): Promise<void> {
  return new Promise((resolve) => {
    const req = request(
      {
        host: '127.0.0.1',
        port: Number(process.env.PORT ?? 3100),
        path: page.path,
        method: 'GET',
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          host: page.host,
          'user-agent': WARM_USER_AGENT,
          ...(page.proto ? { 'x-forwarded-proto': page.proto } : {}),
        },
      },
      (res) => {
        res.resume()
        res.on('end', resolve)
        res.on('error', () => resolve())
      },
    )
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve())
    req.end()
  })
}
