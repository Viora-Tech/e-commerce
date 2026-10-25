/** SOURCE OF TRUTH: test order purge maths — WHAT covers `discountReleases` / WHY a discount used on several test orders gets every one of those uses back */
import { describe, expect, it } from 'vitest'
import { discountReleases } from './test-orders'

describe('discountReleases', () => {
  it('is empty when no discount was used', () => {
    expect(discountReleases([]).size).toBe(0)
  })

  it('counts one use per usage row, grouped by discount', () => {
    const out = discountReleases([
      { discountId: 'a' },
      { discountId: 'b' },
      { discountId: 'a' },
      { discountId: 'a' },
    ])
    expect(Object.fromEntries(out)).toEqual({ a: 3, b: 1 })
  })
})
