import { describe, expect, it } from 'vitest'
import { forEachLimit, parseConcurrency } from './media-concurrency'

describe('parseConcurrency', () => {
  it('defaults to 2', () => {
    expect(parseConcurrency(['--store', 'demo'])).toBe(2)
  })

  it('takes --concurrency and clamps it to 1..8', () => {
    expect(parseConcurrency(['--concurrency', '4'])).toBe(4)
    expect(parseConcurrency(['--concurrency', '32'])).toBe(8)
    expect(parseConcurrency(['--concurrency', '0'])).toBe(1)
  })

  it('rejects a value that is not a whole number', () => {
    expect(() => parseConcurrency(['--concurrency'])).toThrow()
    expect(() => parseConcurrency(['--concurrency', 'many'])).toThrow()
  })
})

describe('forEachLimit', () => {
  it('runs every item, never more than the limit at once', async () => {
    let active = 0
    let peak = 0
    const seen: number[] = []
    await forEachLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 5))
      seen.push(n)
      active -= 1
    })
    expect(peak).toBe(3)
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('does nothing for no items', async () => {
    let calls = 0
    await forEachLimit([], 4, async () => {
      calls += 1
    })
    expect(calls).toBe(0)
  })
})
