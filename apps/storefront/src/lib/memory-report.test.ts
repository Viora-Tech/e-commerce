/** SOURCE OF TRUTH: storefront memory report — WHAT: one reading's fields / WHY: the 13 Nov 2026 heap crash left nothing in the logs */
import { afterEach, describe, expect, it } from 'vitest'
import { eventLoopStats, memoryReading } from './memory-report'

const g = globalThis as { __storefrontCache?: unknown }

describe('memoryReading', () => {
  afterEach(() => {
    g.__storefrontCache = undefined
  })

  it('reports the heap against its limit, with no render cache yet', () => {
    const r = memoryReading()
    expect(r.heapLimitMb).toBeGreaterThan(0)
    expect(r.heapUsedMb).toBeGreaterThan(0)
    expect(r.heapShare).toBeGreaterThanOrEqual(0)
    expect(r.heapShare).toBeLessThan(1)
    expect(r.renderCache).toBeNull()
  })

  it('reads how full the render cache is', () => {
    g.__storefrontCache = {
      entries: { count: 12, size: 5 * 1024 * 1024 },
      inFlight: { size: 2 },
    }
    expect(memoryReading().renderCache).toEqual({ entries: 12, budgetMb: 5, inFlight: 2 })
  })
})

describe('eventLoopStats', () => {
  it('reports the p99 and worst delay in ms', () => {
    const h = {
      count: 10,
      max: 812_000_000,
      percentile: (p: number) => (p === 99 ? 41_600_000 : 0),
    }
    expect(eventLoopStats(h)).toEqual({ p99Ms: 42, maxMs: 812 })
  })

  it('reports nothing before the monitor has a sample', () => {
    expect(eventLoopStats(null)).toBeNull()
    expect(eventLoopStats({ count: 0, max: 0, percentile: () => 0 })).toBeNull()
  })

  it('is part of a reading, with the render queue', () => {
    const r = memoryReading()
    expect(r).toHaveProperty('eventLoop')
    expect(r).toHaveProperty('renderQueue')
  })
})
