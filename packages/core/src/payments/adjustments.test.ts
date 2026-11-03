import { describe, expect, it } from 'vitest'
import {
  applyPaymentAdjustment,
  formatPaymentAdjustment,
  paymentAdjustmentPaise,
} from './adjustments'

describe('paymentAdjustmentPaise', () => {
  it('returns 0 for no adjustment', () => {
    expect(paymentAdjustmentPaise(10000, undefined)).toBe(0)
    expect(paymentAdjustmentPaise(10000, { type: 'fixed', value: 0 })).toBe(0)
  })

  it('applies fixed fees and discounts verbatim', () => {
    expect(paymentAdjustmentPaise(10000, { type: 'fixed', value: 4900 })).toBe(4900)
    expect(paymentAdjustmentPaise(10000, { type: 'fixed', value: -1000 })).toBe(-1000)
  })

  it('applies percent on the subtotal in basis points, rounding half away from zero', () => {
    expect(paymentAdjustmentPaise(100000, { type: 'percent', value: -200 })).toBe(-2000)
    expect(paymentAdjustmentPaise(9999, { type: 'percent', value: -200 })).toBe(-200)
    expect(paymentAdjustmentPaise(12345, { type: 'percent', value: 150 })).toBe(185)
  })

  it('takes a percent discount off in whole rupees, half away from zero (#1049)', () => {
    // −2% of ₹2,699 is −₹53.98: −₹54, so the shopper pays ₹2,645, not ₹2,645.02.
    expect(paymentAdjustmentPaise(269_900, { type: 'percent', value: -200 })).toBe(-5_400)
    expect(applyPaymentAdjustment(269_900, { type: 'percent', value: -200 }).totalPaise).toBe(
      264_500,
    )
    // −2% of ₹1,025 is −₹20.50 → −₹21; −2% of ₹10 is 20 paise → nothing (not −0).
    expect(paymentAdjustmentPaise(102_500, { type: 'percent', value: -200 })).toBe(-2_100)
    expect(paymentAdjustmentPaise(1_000, { type: 'percent', value: -200 })).toBe(0)
  })

  it('agrees with the product page’s "₹X with UPI" table (blocks product-page-parity test)', () => {
    const cases: [number, number, number][] = [
      [269_900, -200, 264_500],
      [649_900, -300, 630_400],
      [99_999, -200, 97_999],
      [1_000, -200, 1_000],
    ]
    for (const [price, bp, expected] of cases)
      expect(applyPaymentAdjustment(price, { type: 'percent', value: bp }).totalPaise).toBe(
        expected,
      )
  })
})

describe('applyPaymentAdjustment', () => {
  it('adds the adjustment to the total', () => {
    expect(applyPaymentAdjustment(10000, { type: 'fixed', value: 4900 })).toEqual({
      adjustmentPaise: 4900,
      totalPaise: 14900,
    })
  })

  it('never lets a discount go below zero', () => {
    expect(applyPaymentAdjustment(1000, { type: 'fixed', value: -5000 })).toEqual({
      adjustmentPaise: -5000,
      totalPaise: 0,
    })
  })
})

describe('formatPaymentAdjustment', () => {
  it('formats rupees and percents with a sign', () => {
    expect(formatPaymentAdjustment({ type: 'fixed', value: 4900 })).toBe('+₹49')
    expect(formatPaymentAdjustment({ type: 'fixed', value: -1050 })).toBe('−₹10.50')
    expect(formatPaymentAdjustment({ type: 'percent', value: -200 })).toBe('−2%')
    expect(formatPaymentAdjustment({ type: 'percent', value: 150 })).toBe('+1.5%')
  })
})
