/** SOURCE OF TRUTH: gift card usage limit tests (#993) — WHAT: when a card with a use cap is used up / WHY: guard the usage limit */
import { describe, expect, it } from 'vitest'
import { usedUp } from './service'

describe('gift card usage limit (#993)', () => {
  it('never runs out without a limit', () => {
    expect(usedUp({ usageLimit: null, useCount: 50 })).toBe(false)
  })
  it('runs out once checkouts reach the limit', () => {
    expect(usedUp({ usageLimit: 2, useCount: 1 })).toBe(false)
    expect(usedUp({ usageLimit: 2, useCount: 2 })).toBe(true)
  })
})
