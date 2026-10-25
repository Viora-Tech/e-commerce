import { describe, expect, it } from 'vitest'
import {
  MAX_SPRITE_DOT_SAMPLES,
  pickSpriteDotSamples,
  spriteDotRadiusPx,
  spriteDotSpacing,
} from './sprite-dots'

describe('sprite dots', () => {
  it("matches cobe's spacing at 32k dots", () => {
    // cobe's dot radius (0.008) is a bit under 0.4 of the spacing between its dots.
    expect(0.008 / spriteDotSpacing(32000)).toBeCloseTo(0.376, 2)
  })

  it('uses more dots for a bigger globe, snapped to steps, and never past the shader limit', () => {
    const small = pickSpriteDotSamples(90, 2)
    const big = pickSpriteDotSamples(360, 3.5)
    expect(big).toBeGreaterThan(small)
    expect(pickSpriteDotSamples(361, 3.5)).toBe(big)
    expect(pickSpriteDotSamples(5000, 1)).toBeLessThanOrEqual(MAX_SPRITE_DOT_SAMPLES)
    expect(pickSpriteDotSamples(1, 10)).toBe(16000)
  })

  it('keeps the on-screen spacing near the target', () => {
    const samples = pickSpriteDotSamples(200, 3.5)
    const spacingPx = spriteDotSpacing(samples) * 200
    expect(spacingPx).toBeGreaterThan(3)
    expect(spacingPx).toBeLessThan(5)
  })

  it('sizes a dot as a share of the spacing, with a floor', () => {
    const r = spriteDotRadiusPx(32000, 400, 0.3)
    expect(r).toBeCloseTo(0.3 * spriteDotSpacing(32000) * 400, 6)
    expect(spriteDotRadiusPx(120000, 10, 0.3)).toBe(0.75)
  })
})
