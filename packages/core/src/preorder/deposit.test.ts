import { describe, expect, it } from 'vitest'
import { computeDeposit, computeDepositFromSettings, depositPreview } from './deposit'

describe('computeDeposit', () => {
  it('full mode charges everything now', () => {
    expect(computeDeposit(499900, 'full')).toEqual({ depositPaise: 499900, balancePaise: 0 })
  })

  it('fixed mode charges the flat amount per unit', () => {
    expect(computeDeposit(999800, 'fixed', { depositPaise: 100000, quantity: 2 })).toEqual({
      depositPaise: 200000,
      balancePaise: 799800,
    })
  })

  it('fixed mode never charges more than the line total', () => {
    expect(computeDeposit(50000, 'fixed', { depositPaise: 100000, quantity: 1 })).toEqual({
      depositPaise: 50000,
      balancePaise: 0,
    })
  })

  it('percentage mode rounds to the nearest paise', () => {
    // 33% of 100 paise = 33 paise exactly
    expect(computeDeposit(100, 'percentage', { depositPercent: 33 })).toEqual({
      depositPaise: 33,
      balancePaise: 67,
    })
    // 33% of 333333 paise = 109999.89 -> rounds to 110000
    expect(computeDeposit(333333, 'percentage', { depositPercent: 33 })).toEqual({
      depositPaise: 110000,
      balancePaise: 223333,
    })
    // 1% of 1 paise rounds down to 0
    expect(computeDeposit(1, 'percentage', { depositPercent: 1 })).toEqual({
      depositPaise: 0,
      balancePaise: 1,
    })
  })

  it('percentage mode never exceeds the line total (99% rounding edge)', () => {
    const result = computeDeposit(101, 'percentage', { depositPercent: 99 })
    expect(result.depositPaise).toBeLessThanOrEqual(101)
    expect(result.depositPaise + result.balancePaise).toBe(101)
  })

  it('rejects a negative line total', () => {
    expect(() => computeDeposit(-1, 'full')).toThrow()
  })

  it('computeDepositFromSettings reads the resolved settings shape', () => {
    const result = computeDepositFromSettings(100000, {
      paymentMode: 'percentage',
      depositPaise: null,
      depositPercent: 25,
    })
    expect(result).toEqual({ depositPaise: 25000, balancePaise: 75000 })
  })

  it('depositPreview maps to pay-now / pay-later copy fields', () => {
    expect(depositPreview({ depositPaise: 100, balancePaise: 200 })).toEqual({
      payNowPaise: 100,
      payLaterPaise: 200,
    })
  })
})
