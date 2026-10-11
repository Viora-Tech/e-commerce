import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../theme/vars'
import {
  ACCENT_PRESETS,
  accentCookieValue,
  accentCss,
  accentForeground,
  accentOverride,
  DEFAULT_ACCENT,
  deriveAccentPalette,
  hexToOklch,
  KIT_PALETTE,
  normaliseAccent,
  OCEAN_GREEN,
  oklchToHex,
  readAccentCookie,
} from './accent'

describe('normaliseAccent', () => {
  it('accepts 3 and 6 digit hex with or without the hash', () => {
    expect(normaliseAccent('#2563EB')).toBe('#2563eb')
    expect(normaliseAccent('2563eb')).toBe('#2563eb')
    expect(normaliseAccent(' #abc ')).toBe('#aabbcc')
  })

  it('refuses anything else, including CSS injection', () => {
    for (const bad of ['', '#12345', '#ggg', 'red', '#fff;}body{display:none', 12, null]) {
      expect(normaliseAccent(bad)).toBeNull()
    }
  })

  it('treats the default as no override', () => {
    expect(accentOverride('#3F72DC')).toBeNull()
    expect(accentOverride('#4EA674')).toBe('#4ea674')
    expect(accentOverride('#2563eb')).toBe('#2563eb')
    expect(accentOverride('nope')).toBeNull()
  })
})

describe('OKLCH round trip', () => {
  it('returns every preset unchanged', () => {
    for (const p of ACCENT_PRESETS) expect(oklchToHex(hexToOklch(p.hex))).toBe(p.hex)
  })

  it('pulls an out-of-gamut colour back into sRGB keeping the hue', () => {
    const hex = oklchToHex({ l: 0.9, c: 0.4, h: 145 })
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(Math.abs(hexToOklch(hex).h - 145)).toBeLessThan(3)
  })
})

describe('accentForeground', () => {
  it('keeps white text on a dark enough accent', () => {
    expect(accentForeground('#2563eb')).toBe('#ffffff')
    expect(accentForeground('#475569')).toBe('#ffffff')
  })

  it('switches to near-black when white misses AA and ink does better', () => {
    const fg = accentForeground('#d97706')
    expect(fg).not.toBe('#ffffff')
    expect(contrastRatio(fg, '#d97706')).toBeGreaterThan(contrastRatio('#ffffff', '#d97706'))
    expect(hexToOklch(fg).l).toBeLessThan(0.25)
  })

  it('reaches AA on every preset in both modes', () => {
    for (const p of ACCENT_PRESETS.slice(1)) {
      const { light, dark } = deriveAccentPalette(p.hex)
      expect(contrastRatio(light.primaryForeground, light.primary)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(dark.primaryForeground, dark.primary)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('deriveAccentPalette', () => {
  it('keeps the kit tokens exactly for the default', () => {
    expect(deriveAccentPalette(DEFAULT_ACCENT)).toBe(KIT_PALETTE)
  })

  it('derives a full palette for Ocean Green, now an ordinary preset', () => {
    const { light, dark } = deriveAccentPalette('#4ea675')
    expect(light.primary).toBe('#4ea675')
    // Aqua Spring #eaf8e7 and Surf Crest #c1e6ba are light, low-chroma greens.
    expect(hexToOklch(light.primarySoft).l).toBeGreaterThan(0.95)
    expect(hexToOklch(light.primaryTint).l).toBeCloseTo(0.89, 1)
    // Kit dark primary #5fbf87 is lighter than the light one with the same hue.
    expect(hexToOklch(dark.primary).l).toBeGreaterThan(hexToOklch(light.primary).l)
    expect(Math.abs(hexToOklch(dark.primary).h - hexToOklch(OCEAN_GREEN).h)).toBeLessThan(3)
    expect(dark.primarySoft).toBe('rgb(78 166 117 / 0.16)')
    // Same choice of text colour as the kit made for #5fbf87 in dark mode.
    expect(hexToOklch(dark.primaryForeground).l).toBeLessThan(0.25)
    expect(hexToOklch(dark.primaryTint).l).toBeLessThan(0.5)
  })

  it('lifts a very dark accent so it reads on the dark canvas', () => {
    const { dark } = deriveAccentPalette('#111827')
    expect(hexToOklch(dark.primary).l).toBeGreaterThanOrEqual(0.61)
  })
})

describe('accentCss', () => {
  it('overrides when Ocean Green is picked (it used to fall through to the blue default)', () => {
    expect(accentCss(OCEAN_GREEN)).toContain('--primary:#4ea674')
  })

  it('is empty for the default, nothing, or an invalid value', () => {
    expect(accentCss(DEFAULT_ACCENT)).toBe('')
    expect(accentCss(null)).toBe('')
    expect(accentCss('#fff;}html{x:y')).toBe('')
  })

  it('overrides every brand token for light and dark', () => {
    const css = accentCss('#2563eb')
    expect(css.startsWith(':root:root{--primary:#2563eb;--primary-foreground:#ffffff;')).toBe(true)
    expect(css).toContain(':root.dark{--primary:')
    for (const token of ['--primary-soft', '--primary-tint', '--ring', '--chart-1']) {
      expect(css.split(token).length).toBe(3)
    }
  })

  it('scopes the preview to a selector, writing out the default too', () => {
    const css = accentCss('#e11d48', '#preview')
    expect(css.startsWith('#preview{--primary:#e11d48')).toBe(true)
    expect(css).toContain('.dark #preview{')
    expect(accentCss(DEFAULT_ACCENT, '#preview')).toContain('--primary-soft:#eaf1fd')
    expect(accentCss('nope', '#preview')).toBe('')
  })
})

describe('accent cookie', () => {
  it('round trips per store', () => {
    expect(readAccentCookie(accentCookieValue('s1', '#2563EB'), 's1')).toBe('#2563eb')
    expect(readAccentCookie(accentCookieValue('s1', null), 's1')).toBeNull()
  })

  it('ignores another store, a missing cookie and tampered values', () => {
    expect(readAccentCookie(accentCookieValue('s1', '#2563eb'), 's2')).toBeUndefined()
    expect(readAccentCookie(undefined, 's1')).toBeUndefined()
    expect(readAccentCookie('s1~zzz', 's1')).toBeUndefined()
    expect(readAccentCookie('s1~', 's1')).toBeUndefined()
    expect(readAccentCookie('s1~2563eb~x', 's1')).toBeUndefined()
  })
})
