import { getHeapStatistics } from 'node:v8'
import { logger } from '@commerce/observability/logging'

/** How often the process reports its memory. */
const EVERY_MS = 10 * 60_000
/** Past this share of the heap limit the report is a warning. */
const WARN_SHARE = 0.75

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024)

/** The render cache's shared state (`store-cache.ts`), read off `globalThis` so boot imports nothing. */
type RenderCacheView = {
  entries: { count: number; size: number }
  inFlight: { size: number }
}

function renderCacheStats() {
  const s = (globalThis as { __storefrontCache?: RenderCacheView }).__storefrontCache
  if (!s) return null
  return { entries: s.entries.count, budgetMb: mb(s.entries.size), inFlight: s.inFlight.size }
}

/** One reading: the process's memory next to how full the render cache is. */
export function memoryReading() {
  const m = process.memoryUsage()
  const limit = getHeapStatistics().heap_size_limit
  return {
    uptimeMin: Math.round(process.uptime() / 60),
    rssMb: mb(m.rss),
    heapUsedMb: mb(m.heapUsed),
    heapTotalMb: mb(m.heapTotal),
    heapLimitMb: mb(limit),
    externalMb: mb(m.external),
    arrayBuffersMb: mb(m.arrayBuffers),
    heapShare: Math.round((m.heapUsed / limit) * 100) / 100,
    renderCache: renderCacheStats(),
  }
}

let started = false

/**
 * Logs `storefront memory` every ten minutes, a warning once the heap passes three quarters of
 * its limit. The storefront ran out of heap after about a day on 13 Nov 2026 with nothing in the
 * logs before it; these readings show whether the heap climbs while the render cache stays at
 * its budget (a leak elsewhere) or the cache itself is what grows.
 */
export function startMemoryReport(): void {
  if (started) return
  started = true
  const timer = setInterval(() => {
    const reading = memoryReading()
    if (reading.heapShare >= WARN_SHARE) logger.warn('storefront memory', reading)
    else logger.info('storefront memory', reading)
  }, EVERY_MS)
  timer.unref?.()
}
