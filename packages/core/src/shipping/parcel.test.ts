/** SOURCE OF TRUTH: parcel weight — tests resolveParcelWeightGrams (products + packing) */
import { describe, expect, it } from 'vitest'
import {
  effectiveWeightGrams,
  parcelBoxPreset,
  resolveParcelPackage,
  resolveParcelWeightGrams,
  volumetricWeightGrams,
} from './parcel'

describe('resolveParcelWeightGrams', () => {
  it('adds the box packing to the products when every line has a weight', () => {
    // Two 400 g mice in the mouse box (70 g of carton and invoice).
    const grams = resolveParcelWeightGrams(
      [
        { quantity: 2, variantWeightGrams: 400 },
        { quantity: 1, variantWeightGrams: 100 },
      ],
      70,
    )
    expect(grams).toBe(2 * 400 + 100 + 70)
  })

  it('counts 500 g for the products when any line has no weight, plus the packing', () => {
    const grams = resolveParcelWeightGrams(
      [
        { quantity: 2, variantWeightGrams: 150 },
        { quantity: 1, variantWeightGrams: null },
      ],
      70,
    )
    expect(grams).toBe(500 + 70)
  })

  it('never uses the box as the whole parcel', () => {
    expect(resolveParcelWeightGrams([], 300)).toBe(800)
    expect(resolveParcelWeightGrams([{ quantity: 0, variantWeightGrams: 100 }], 300)).toBe(800)
  })

  it('treats products saved at 0 g as unknown (bulk quote 400)', () => {
    expect(
      resolveParcelWeightGrams(
        [
          { quantity: 2, variantWeightGrams: 0 },
          { quantity: 1, variantWeightGrams: 0 },
        ],
        10,
      ),
    ).toBe(510)
  })

  it('adds nothing for a box with no packing weight', () => {
    expect(resolveParcelWeightGrams([{ quantity: 1, variantWeightGrams: 400 }], 0)).toBe(400)
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

  it('uses the biggest package when lines differ (the small items pack inside it, #2461)', () => {
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
    expect(dims).toEqual({ lengthCm: 30, widthCm: 20, heightCm: 10 })
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

describe('parcelBoxPreset', () => {
  const cable = { id: 'cable', isDefault: true, lengthCm: 20, widthCm: 20, heightCm: 5 }
  const glass = { id: 'glass', isDefault: false, lengthCm: 64, widthCm: 64, heightCm: 8 }
  const skates = { id: 'skates', isDefault: false, lengthCm: 20, widthCm: 20, heightCm: 4 }
  const boxes = [cable, glass, skates]
  const line = (boxPresetId: string | null, quantity = 1) => ({ quantity, boxPresetId })

  it("uses the products' box when they agree", () => {
    expect(parcelBoxPreset([line('skates'), line('skates')], boxes)).toBe(skates)
  })

  it('uses the biggest box when products pick different ones (glasspad + skates, #2461)', () => {
    expect(parcelBoxPreset([line('glass'), line('skates')], boxes)).toBe(glass)
  })

  it('ignores lines with no box, and falls back to the main box when none has one', () => {
    expect(parcelBoxPreset([line('glass'), line(null)], boxes)).toBe(glass)
    expect(parcelBoxPreset([line(null)], boxes)).toBe(cable)
    expect(parcelBoxPreset([line('glass', 0), line(null)], boxes)).toBe(cable)
  })
})
