import { type IntervalHistogram, monitorEventLoopDelay } from 'node:perf_hooks'
import { getHeapStatistics } from 'node:v8'
import { logger } from '@commerce/observability/logging'
import { renderQueueStats } from './render-gate'

/** How often the process reports its memory. */
const EVERY_MS = 10 * 60_000
/** Past this share of the heap limit the report is a warning. */
const WARN_SHARE = 0.75
/** How finely the event loop's delay is sampled, in ms. */
const LOOP_RESOLUTION_MS = 20

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024)
const ms = (nanoseconds: number) => Math.round(nanoseconds / 1e6)

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

/**
 * How late the event loop ran since the last reading, in ms: its 99th percentile and its worst.
 * A busy loop (a render burst, 26 Nov 2026) makes every request wait, cached or not.
 */
export function eventLoopStats(h: Pick<IntervalHistogram, 'percentile' | 'max' | 'count'> | null) {
  if (!h || h.count === 0) return null
  return { p99Ms: ms(h.percentile(99)), maxMs: ms(h.max) }
}

let loopDelay: IntervalHistogram | null = null

/** One reading: the process's memory next to how full the render cache is, and how late the loop runs. */
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
    renderQueue: renderQueueStats(),
    eventLoop: eventLoopStats(loopDelay),
  }
}

let started = false

/**
 * Logs `storefront memory` every ten minutes, a warning once the heap passes three quarters of
 * its limit. The storefront ran out of heap after about a day on 13 Nov 2026 with nothing in the
 * logs before it; these readings show whether the heap climbs while the render cache stays at
 * its budget (a leak elsewhere) or the cache itself is what grows. The event loop's delay over
 * the ten minutes is in it too, so a stall shows up even when memory is fine.
 */
export function startMemoryReport(): void {
  if (started) return
  started = true
  loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS })
  loopDelay.enable()
  const timer = setInterval(() => {
    const reading = memoryReading()
    loopDelay?.reset()
    if (reading.heapShare >= WARN_SHARE) logger.warn('storefront memory', reading)
    else logger.info('storefront memory', reading)
  }, EVERY_MS)
  timer.unref?.()
}
