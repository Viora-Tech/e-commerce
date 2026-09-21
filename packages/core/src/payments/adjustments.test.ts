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
