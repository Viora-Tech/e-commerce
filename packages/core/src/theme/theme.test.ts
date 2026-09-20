import { describe, expect, it } from 'vitest'
import { themeToCss } from './css'
import { defaultTheme, parseTheme } from './schema'

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

  it('exposes every scheme as a class for per-section use', () => {
    expect(css).toContain('.color-scheme-4{')
    expect(css).toMatch(/\.color-scheme-4\{[^}]*--color-brand:#FFFFFF/)
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
    expect(css).toContain('--section-radius:clamp(16px, 1.578vw, 30px)')
    expect(themeToCss({ ...defaultTheme, roundedSections: false })).toContain(
      '--section-radius:0px',
    )
  })
})
