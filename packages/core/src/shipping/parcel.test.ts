/** SOURCE OF TRUTH: parcel weight — tests resolveParcelWeightGrams's fallback rules */
import { describe, expect, it } from 'vitest'
import { resolveParcelWeightGrams } from './parcel'

describe('resolveParcelWeightGrams', () => {
  it('sums quantity * variant weight when every line has one', () => {
    const grams = resolveParcelWeightGrams(
      [
        { quantity: 2, variantWeightGrams: 150 },
        { quantity: 1, variantWeightGrams: 400 },
      ],
      250,
    )
    expect(grams).toBe(2 * 150 + 400)
  })

  it('falls back to the box weight when any line has no variant weight', () => {
    const grams = resolveParcelWeightGrams(
      [
        { quantity: 2, variantWeightGrams: 150 },
        { quantity: 1, variantWeightGrams: null },
      ],
      250,
    )
    expect(grams).toBe(250)
  })

  it('falls back to the box weight with no lines', () => {
    expect(resolveParcelWeightGrams([], 300)).toBe(300)
  })

  it('falls back to the box weight when a weighed line has zero quantity', () => {
    expect(resolveParcelWeightGrams([{ quantity: 0, variantWeightGrams: 100 }], 300)).toBe(300)
  })
})
