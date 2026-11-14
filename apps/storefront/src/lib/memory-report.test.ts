/** SOURCE OF TRUTH: storefront memory report — WHAT: one reading's fields / WHY: the 13 Nov 2026 heap crash left nothing in the logs */
import { afterEach, describe, expect, it } from 'vitest'
import { memoryReading } from './memory-report'

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
