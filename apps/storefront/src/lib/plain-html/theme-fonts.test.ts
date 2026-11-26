import { describe, expect, it } from 'vitest'
import { THEME_COMPAT_CSS } from './theme-compat'
import { linkedFamilies, namedFamilies, ourFontsHref } from './theme-fonts'

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

  it('leaves the families the theme already links to the theme', () => {
    // Waimers: the theme links Archivo and Figtree itself, and names Plus Jakarta Sans unlinked.
    const themeHead =
      'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&amp;family=Figtree:ital,wght@0,500;0,800;1,500&amp;display=swap ' +
      '<link rel="stylesheet" media="print" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&amp;display=swap">'
    expect([...linkedFamilies(themeHead)].sort()).toEqual(['Archivo', 'Figtree', 'Noto Sans JP'])
    const page = `<style>:root{--font-body:"Figtree", sans-serif;--font-heading:'Plus Jakarta Sans','Noto Sans JP';--font-x:Archivo,sans-serif}</style>`
    expect(ourFontsHref(page, themeHead)).toBe(
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap',
    )
    expect(ourFontsHref(`<style>:root{--font-body:"Figtree"}</style>`, themeHead)).toBeNull()
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
