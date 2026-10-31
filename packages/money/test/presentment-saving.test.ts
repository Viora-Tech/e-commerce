import { describe, expect, it } from 'vitest'
import { formatPresentment, formatPresentmentSaving, type MarketPricing } from '../src/index'

const aed: MarketPricing = { currency: 'AED', rate: 0.0441, adjustmentBp: 0, rounding: 'none' }

describe('formatPresentmentSaving (#57)', () => {
  it('is the gap between the two prices as shown, not the converted difference', () => {
    // Each price rounds on its own; the saving must be their difference as shown.
    const mrp = 70_045 // 30.889… → 30.89
    const price = 52_545 // 23.172… → 23.17
    const shown =
      Number(formatPresentment(mrp, aed).replace(/[^\d.]/g, '')) -
      Number(formatPresentment(price, aed).replace(/[^\d.]/g, ''))
    expect(formatPresentmentSaving(mrp, price, aed).replace(/[^\d.]/g, '')).toBe(shown.toFixed(2))
  })
  it('keeps rupees as the plain difference', () => {
    expect(formatPresentmentSaving(150_000, 100_000, null)).toBe(formatPresentment(50_000, null))
  })
})
