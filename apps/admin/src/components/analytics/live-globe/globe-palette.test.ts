import { describe, expect, it } from 'vitest'
import { readPalette } from './globe-palette'

/* Node, no `window`: `readCssColorVar` returns each token's fallback, so "Store accent" reads
   as the fallback primary (dark [0.19, 0.82, 0.34]) and muted ink (light [0.6, 0.6, 0.62]). */
const accent = {
  theme: 'accent',
  customLand: null,
  customOcean: null,
  customAccent: null,
  customBorder: null,
} as const

describe('readPalette', () => {
  it('gives the Live view globe the Home card palette for "Store accent"', () => {
    const home = readPalette(true, undefined, true)
    const live = readPalette(true, accent, true)
    expect(live.base).toEqual(home.base)
    expect(live.glow).toEqual(home.glow)
    // cobe's baseColor in dark mode is the deep accent, used as is for the dots.
    expect(live.dotColor).toEqual(home.base)
    // The sprite dots use the accent itself, softened, never brightened past it to white.
    for (const [i, c] of live.landDot.entries()) {
      expect(c).toBeCloseTo(Math.min(1, (live.dotColor[i] ?? 0) / 0.38) * 0.8)
    }
    expect(live.swatches.land).toBe('#27a745')
  })

  it('draws preset and picked land colours exactly in dark mode', () => {
    const night = readPalette(true, { ...accent, theme: 'night' }, true)
    for (const [i, c] of night.landDot.entries()) expect(c).toBeCloseTo(night.base[i] ?? 0)
    const picked = readPalette(true, { ...accent, customLand: '#ff0000' }, true)
    expect(picked.landDot).toEqual([1, 0, 0])
  })

  it("shades light-mode dots towards a tenth of the base, as cobe's light mode does", () => {
    const live = readPalette(false, accent, true)
    for (const [i, c] of live.dotColor.entries()) expect(c).toBeCloseTo((live.base[i] ?? 0) * 0.1)
  })

  it('applies custom colours so they read as picked', () => {
    const look = {
      ...accent,
      customLand: '#ff0000',
      customOcean: '#102030',
      customAccent: '#00ff00',
    }
    const dark = readPalette(true, look, true)
    expect(dark.swatches).toEqual({
      land: '#ff0000',
      ocean: '#102030',
      accent: '#00ff00',
      border: '#ff3333',
    })
    expect(dark.marker).toEqual([0, 1, 0])
    const light = readPalette(false, look, true)
    expect(light.dotColor).toEqual([1, 0, 0])
    expect(light.swatches.ocean).toBe('#102030')
  })

  it('uses each preset theme without the store accent', () => {
    const night = readPalette(true, { ...accent, theme: 'night' }, true)
    expect(night.base).toEqual([0.16, 0.19, 0.28])
    expect(night.marker).toEqual([0.42, 0.74, 0.98])
  })
})
