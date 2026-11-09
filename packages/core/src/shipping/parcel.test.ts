/** SOURCE OF TRUTH: parcel weight — tests resolveParcelWeightGrams's fallback rules */
import { describe, expect, it } from 'vitest'
import {
  effectiveWeightGrams,
  resolveParcelPackage,
  resolveParcelWeightGrams,
  volumetricWeightGrams,
} from './parcel'

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

  it('falls back to the box weight when the products weigh 0 g (bulk quote 400)', () => {
    expect(
      resolveParcelWeightGrams(
        [
          { quantity: 2, variantWeightGrams: 0 },
          { quantity: 1, variantWeightGrams: 0 },
        ],
        300,
      ),
    ).toBe(300)
  })
})

describe('volumetricWeightGrams', () => {
  it('is L*W*H / 5000 kg, in grams', () => {
    // 20*15*10 = 3000 cm3 / 5000 = 0.6 kg
    expect(volumetricWeightGrams({ lengthCm: 20, widthCm: 15, heightCm: 10 })).toBe(600)
  })

  it('scales with box size', () => {
    // 40*30*20 = 24000 cm3 / 5000 = 4.8 kg
    expect(volumetricWeightGrams({ lengthCm: 40, widthCm: 30, heightCm: 20 })).toBe(4800)
  })

  it('rounds up to the next gram', () => {
    // 7*7*7 = 343 cm3 -> 68.6 g
    expect(volumetricWeightGrams({ lengthCm: 7, widthCm: 7, heightCm: 7 })).toBe(69)
  })
})

describe('effectiveWeightGrams', () => {
  it('returns the actual weight unchanged with no dimensions', () => {
    expect(effectiveWeightGrams(200, null)).toBe(200)
  })

  it('returns the actual weight when it exceeds the volumetric weight', () => {
    // volumetric here is 600g; actual (a dense product) is heavier.
    expect(effectiveWeightGrams(2000, { lengthCm: 20, widthCm: 15, heightCm: 10 })).toBe(2000)
  })

  it('returns the volumetric weight when it exceeds the actual weight', () => {
    // A light, bulky parcel: actual 150g but a big box.
    expect(effectiveWeightGrams(150, { lengthCm: 40, widthCm: 30, heightCm: 20 })).toBe(4800)
  })
})

describe('resolveParcelPackage', () => {
  const presets = [{ id: 'box-1', lengthCm: 30, widthCm: 20, heightCm: 10 }]

  it('returns null with no packed lines', () => {
    expect(resolveParcelPackage([], presets)).toBeNull()
    expect(
      resolveParcelPackage(
        [
          {
            quantity: 0,
            boxPresetId: 'box-1',
            packageLengthCm: null,
            packageWidthCm: null,
            packageHeightCm: null,
          },
        ],
        presets,
      ),
    ).toBeNull()
  })

  it('uses custom variant dimensions when set', () => {
    const dims = resolveParcelPackage(
      [
        {
          quantity: 1,
          boxPresetId: null,
          packageLengthCm: 25,
          packageWidthCm: 18,
          packageHeightCm: 8,
        },
      ],
      presets,
    )
    expect(dims).toEqual({ lengthCm: 25, widthCm: 18, heightCm: 8 })
  })

  it('resolves a named box preset when no custom dims are set', () => {
    const dims = resolveParcelPackage(
      [
        {
          quantity: 1,
          boxPresetId: 'box-1',
          packageLengthCm: null,
          packageWidthCm: null,
          packageHeightCm: null,
        },
      ],
      presets,
    )
    expect(dims).toEqual({ lengthCm: 30, widthCm: 20, heightCm: 10 })
  })

  it('falls back to null when lines disagree on the package', () => {
    const dims = resolveParcelPackage(
      [
        {
          quantity: 1,
          boxPresetId: 'box-1',
          packageLengthCm: null,
          packageWidthCm: null,
          packageHeightCm: null,
        },
        {
          quantity: 1,
          boxPresetId: null,
          packageLengthCm: 25,
          packageWidthCm: 18,
          packageHeightCm: 8,
        },
      ],
      presets,
    )
    expect(dims).toBeNull()
  })

  it('falls back to null when a package side is 0 cm', () => {
    const dims = resolveParcelPackage(
      [
        {
          quantity: 1,
          boxPresetId: null,
          packageLengthCm: 0,
          packageWidthCm: 0,
          packageHeightCm: 0,
        },
      ],
      presets,
    )
    expect(dims).toBeNull()
  })

  it('falls back to null when no line has a package', () => {
    const dims = resolveParcelPackage(
      [
        {
          quantity: 1,
          boxPresetId: null,
          packageLengthCm: null,
          packageWidthCm: null,
          packageHeightCm: null,
        },
      ],
      presets,
    )
    expect(dims).toBeNull()
  })
})
