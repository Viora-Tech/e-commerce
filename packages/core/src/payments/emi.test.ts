import { describe, expect, it } from 'vitest'
import { lowestEmiPaise, monthlyEmiPaise } from './emi'

describe('monthlyEmiPaise', () => {
  it('divides evenly', () => {
    expect(monthlyEmiPaise(120000, 12)).toBe(10000)
  })

  it('rounds up so instalments cover the price', () => {
    expect(monthlyEmiPaise(100000, 3)).toBe(33334)
    expect(monthlyEmiPaise(100000, 3) * 3).toBeGreaterThanOrEqual(100000)
  })

  it('rejects bad input', () => {
    expect(() => monthlyEmiPaise(100.5, 3)).toThrow(RangeError)
    expect(() => monthlyEmiPaise(1000, 0)).toThrow(RangeError)
  })
})

describe('lowestEmiPaise', () => {
  it('uses the longest tenure', () => {
    expect(lowestEmiPaise(120000)).toBe(10000)
    expect(lowestEmiPaise(120000, [3, 6])).toBe(20000)
  })
})
