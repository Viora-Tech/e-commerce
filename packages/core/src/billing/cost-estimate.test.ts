/** SOURCE OF TRUTH: monthly cost estimate tests — WHAT: plan price plus per-order fees for a store size / WHY: the pricing page's calculator must match what billing charges */
import { describe, expect, it } from 'vitest'
import { bestPlan, monthlyCost } from './cost-estimate'

describe('monthlyCost', () => {
  it('a 40-order seller pays only Starter', () => {
    expect(monthlyCost('starter', 40, 800)).toEqual({ planInr: 499, feeInr: 0, totalInr: 499 })
  })

  it('charges the fee on orders past the included ones', () => {
    expect(monthlyCost('growth', 300, 1000).feeInr).toBe(750)
    expect(monthlyCost('growth', 300, 1000).totalInr).toBe(2749)
  })

  it('never charges a fee on Scale', () => {
    expect(monthlyCost('scale', 5000, 1000).feeInr).toBe(0)
  })
})

describe('bestPlan', () => {
  it('picks the cheapest total, not the first plan that fits', () => {
    expect(bestPlan(40, 800)).toBe('starter')
    // Pro: 4,999 + 2,100 × ₹5 = 15,499 > Scale's 14,999.
    expect(bestPlan(2600, 1000)).toBe('scale')
    // Starter at 120 orders of ₹1,000: 499 + 700 = 1,199 < Growth's 1,999.
    expect(bestPlan(120, 1000)).toBe('starter')
  })
})
