import { describe, expect, it } from 'vitest'
import { themeToCss } from './css'
import { applyThemePreset } from './presets'
import { signThemePreviewToken, verifyThemePreviewToken } from './preview-token'
import { defaultTheme, parseTheme, THEME_PRESET_IDS, ThemeSchema } from './schema'
import { contrastRatio, themeContrastWarnings, themeRootAttrs, themeToCssVars } from './vars'

describe('parseTheme', () => {
  it('accepts the default theme unchanged', () => {
    expect(parseTheme(defaultTheme)).toEqual(defaultTheme)
  })

  it('falls back to defaults on invalid or missing input', () => {
    expect(parseTheme(null)).toEqual(defaultTheme)
    expect(
      parseTheme({ ...defaultTheme, shared: { success: 'green', danger: '#000000' } }),
    ).toEqual(defaultTheme)
  })
})

describe('themeToCss', () => {
  const css = themeToCss(defaultTheme)

  it('puts the light scheme on :root and the dark scheme under [data-theme=dark]', () => {
    expect(css).toMatch(/:root\{[^}]*--color-bg:#F3F3F3/)
    expect(css).toMatch(/:root\[data-theme=dark\]\{[^}]*--color-bg:#1F1F21/)
  })

  it('applies the dark scheme for system preference unless light is forced', () => {
    expect(css).toMatch(
      /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme=light\]\)\{[^}]*--color-bg:#1F1F21/,
    )
  })

  it('exposes every scheme as a class that paints itself', () => {
    expect(css).toContain('.color-scheme-4{')
    expect(css).toMatch(/\.color-scheme-4\{[^}]*--color-brand:#FFFFFF/)
    expect(css).toMatch(/\.color-scheme-4\{[^}]*background-color:var\(--color-bg\)/)
  })

  it('swaps a section wearing the light scheme to the dark scheme in dark mode', () => {
    expect(css).toMatch(/:root\[data-theme=dark\] \.color-scheme-5\{[^}]*--color-bg:#1F1F21/)
    expect(css).not.toMatch(/:root\[data-theme=dark\] \.color-scheme-4\{/)
  })

  it('uses the light scheme for dark when dark mode is disabled', () => {
    const off = themeToCss({
      ...defaultTheme,
      darkMode: { ...defaultTheme.darkMode, enabled: false },
    })
    expect(off).toMatch(/:root\[data-theme=dark\]\{[^}]*--color-bg:#F3F3F3/)
  })

  it('carries shared tokens and shape', () => {
    expect(css).toContain('--color-success:#1F9254')
    expect(css).toContain('--section-radius:clamp(1rem, 1.578vw, 1.875rem)')
    expect(themeToCss({ ...defaultTheme, roundedSections: false })).toContain(
      '--section-radius:0rem',
    )
  })

  it('does not claim a dark colour scheme when dark mode is off', () => {
    const off = themeToCss({
      ...defaultTheme,
      darkMode: { ...defaultTheme.darkMode, enabled: false },
    })
    expect(off).toMatch(/:root\[data-theme=dark\]\{[^}]*color-scheme:light\}/)
  })
})

describe('backwards compatibility', () => {
  it('parses a theme saved before the editor existed to the same look plus defaults', () => {
    const { sharedDark, shape, layout, buttons, cards, brand, preset, ...legacy } = defaultTheme
    const old = {
      ...legacy,
      shared: { success: '#1F9254', danger: '#D2331F' },
      fonts: { heading: 'archivo', body: 'figtree', headingScale: 1, bodySizePx: 16 },
    }
    expect(parseTheme(old)).toEqual(defaultTheme)
  })

  it('accepts every curated font', () => {
    const t = parseTheme({ ...defaultTheme, fonts: { ...defaultTheme.fonts, heading: 'fraunces' } })
    expect(t.fonts.heading).toBe('fraunces')
  })
})

describe('themeToCssVars', () => {
  it('emits the mode palette and the shared layout values in rem', () => {
    const light = themeToCssVars(defaultTheme, 'light')
    const dark = themeToCssVars(defaultTheme, 'dark')
    expect(light['--color-bg']).toBe('#F3F3F3')
    expect(dark['--color-bg']).toBe('#1F1F21')
    expect(dark['--color-sale']).toBe(defaultTheme.sharedDark.sale)
    expect(light['--radius-button']).toBe('0.5rem')
    expect(light['--page-width']).toBe('90rem')
    expect(light['--space-8']).toBe('3rem')
    expect(light['--font-heading']).toBe('var(--font-archivo, "Archivo"), sans-serif')
  })

  it('scales the section rhythm and switches button colours', () => {
    const t = {
      ...defaultTheme,
      layout: { pageWidth: 1280, sectionSpacing: 1.5 },
      buttons: { ...defaultTheme.buttons, colour: 'brand' as const, uppercase: false },
    }
    const v = themeToCssVars(t, 'light')
    expect(v['--space-8']).toBe('4.5rem')
    expect(v['--btn-bg']).toBe('var(--color-brand)')
    expect(v['--btn-transform']).toBe('none')
  })

  it('exposes card and button switches as root attributes', () => {
    expect(themeRootAttrs(defaultTheme)).toEqual({
      'data-button-style': 'solid',
      'data-card-vendor': 'off',
      'data-card-sale-badge': 'off',
      'data-card-hover': 'on',
      'data-card-ratio': 'square',
    })
  })
})

describe('contrast', () => {
  it('measures WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1)
  })

  it('passes the default theme and flags a pale button text', () => {
    // Waimers today: dark-mode sale badges print #1F1F21 on #6C3BAA (about 2:1). The
    // defaults keep that look; the editor shows this warning so the merchant can fix it.
    expect(themeContrastWarnings(defaultTheme).map((w) => `${w.mode}:${w.pair}`)).toEqual([
      'dark:sale',
    ])
    const pale = applyThemePreset(defaultTheme, 'waimers')
    const light = pale.schemes.find((s) => s.id === pale.lightScheme)
    if (!light) throw new Error('no light scheme')
    // A lighter purple on the #6C3BAA brand: roughly 2:1, well under AA.
    light.buttonText = '#A98AD4'
    const warnings = themeContrastWarnings(pale)
    expect(warnings.some((w) => w.mode === 'light' && w.pair === 'onBrand')).toBe(true)
  })
})

describe('presets', () => {
  it('fills the page schemes and keeps the brand', () => {
    const branded = { ...defaultTheme, brand: { ...defaultTheme.brand, logoWidth: 200 } }
    const soft = applyThemePreset(branded, 'soft')
    expect(soft.preset).toBe('soft')
    expect(soft.brand.logoWidth).toBe(200)
    expect(soft.schemes.find((s) => s.id === soft.lightScheme)?.background).toBe('#FBF7F2')
    expect(soft.schemes.find((s) => s.id === 'scheme-4')).toEqual(
      defaultTheme.schemes.find((s) => s.id === 'scheme-4'),
    )
    expect(ThemeSchema.safeParse(soft).success).toBe(true)
  })

  it('round-trips every preset through the schema', () => {
    for (const id of THEME_PRESET_IDS) {
      expect(ThemeSchema.safeParse(applyThemePreset(defaultTheme, id)).success).toBe(true)
    }
  })
})

describe('preview token', () => {
  const secret = 'test-secret'
  it('verifies for its store until it expires', () => {
    const now = 1_800_000_000_000
    const token = signThemePreviewToken({ secret, storeId: 's1', now, ttlSeconds: 60 })
    expect(verifyThemePreviewToken({ secret, storeId: 's1', token, now })).toBe(true)
    expect(verifyThemePreviewToken({ secret, storeId: 's2', token, now })).toBe(false)
    expect(verifyThemePreviewToken({ secret: 'other', storeId: 's1', token, now })).toBe(false)
    expect(verifyThemePreviewToken({ secret, storeId: 's1', token, now: now + 61_000 })).toBe(false)
    expect(verifyThemePreviewToken({ secret, storeId: 's1', token: 'garbage', now })).toBe(false)
  })
})
