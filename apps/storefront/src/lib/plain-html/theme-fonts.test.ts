import { describe, expect, it } from 'vitest'
import { THEME_COMPAT_CSS } from './theme-compat'
import { namedFamilies, ourFontsHref } from './theme-fonts'

describe('our fonts a theme names', () => {
  it('finds our families in font declarations, not in text', () => {
    const html = `<style>:root { --font-heading: 'Plus Jakarta Sans', 'Noto Sans JP', system-ui; }
      body { font-family: "Inter", sans-serif }</style><p>We love Lora and Geist</p>
      <div style="font-family: DM Sans, serif">x</div>`
    expect(namedFamilies(html).sort()).toEqual(['DM Sans', 'Inter', 'Plus Jakarta Sans'])
  })

  it('links them from Google Fonts with the weights we self-host', () => {
    const href = ourFontsHref(`<style>:root{--font-body:'Plus Jakarta Sans',sans-serif}</style>`)
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap',
    )
    expect(ourFontsHref('<style>body{font-family:Assistant,sans-serif}</style>')).toBeNull()
  })
})

describe('theme compat CSS', () => {
  it('keeps the layer order and leaves out the heading rise and Tailwind defaults', () => {
    expect(THEME_COMPAT_CSS.startsWith('@layer theme, base, components, utilities;')).toBe(true)
    expect(THEME_COMPAT_CSS).not.toContain('html.js main :is(h1, h2, h3)')
    expect(THEME_COMPAT_CSS).not.toContain('@layer properties')
    expect(THEME_COMPAT_CSS).not.toContain('</style')
    expect(THEME_COMPAT_CSS.length).toBeLessThan(20_000)
  })
})
