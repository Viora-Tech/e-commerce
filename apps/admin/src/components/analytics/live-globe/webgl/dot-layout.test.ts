import { describe, expect, it } from 'vitest'
import { dotRadiusPx, pickDotRows, TARGET_ROW_SPACING_CSS_PX } from './dot-layout'

describe('pickDotRows', () => {
  it('keeps row spacing at or above the target CSS-pixel spacing (never too crowded)', () => {
    for (const cssRadius of [80, 160, 240, 400]) {
      const dpr = 2
      const rows = pickDotRows(cssRadius * dpr, dpr)
      const spacingCssPx = (Math.PI * cssRadius) / rows
      expect(spacingCssPx).toBeGreaterThanOrEqual(TARGET_ROW_SPACING_CSS_PX - 1e-6)
    }
  })

  it('picks more rows for a bigger on-screen globe', () => {
    const small = pickDotRows(100, 1)
    const big = pickDotRows(1000, 1)
    expect(big).toBeGreaterThan(small)
  })

  it('is stable for dpr: the same CSS-pixel radius gives the same rows regardless of dpr', () => {
    const cssRadius = 200
    expect(pickDotRows(cssRadius * 1, 1)).toBe(pickDotRows(cssRadius * 2, 2))
  })

  it('never returns zero or a negative row count', () => {
    expect(pickDotRows(1, 1)).toBeGreaterThan(0)
  })
})

describe('dotRadiusPx', () => {
  it('is never smaller than the 3-device-px-diameter floor', () => {
    const r = dotRadiusPx(288, 50, 2)
    expect(r).toBeGreaterThanOrEqual(1.5 * 2)
  })

  it('grows with the globe while the row count stays fixed', () => {
    const rows = 40
    const small = dotRadiusPx(rows, 200, 1)
    const big = dotRadiusPx(rows, 800, 1)
    expect(big).toBeGreaterThan(small)
  })

  it('shrinks as more rows pack the same radius', () => {
    const radius = 400
    const fewRows = dotRadiusPx(20, radius, 1)
    const manyRows = dotRadiusPx(150, radius, 1)
    expect(manyRows).toBeLessThan(fewRows)
  })
})
