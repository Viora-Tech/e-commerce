import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The storefront's block CSS loads on every page, imported Shopify themes included, and the
 * Customize canvas mirrors it too. Imported themes built on Zero Drift (Waimers' Glide) share its
 * class names, so the "Figma storefront …" restyles appended to a section's CSS must keep to our
 * own sections (`index.css`): unguarded, Glide's hero arrows took our bottom-left
 * `left: calc(var(--page-margin) + 56px)` (Glide sets only `right`) and sat together on the left,
 * on the live store and in the editor alike.
 */
const STYLES = join(__dirname, '../src/styles')
const GUARD = ':not(:where(.shopify-section *))'
const BANNER = /^\/\* Figma storefront .*\(Section \//m

/** Selectors of every style rule in `css` (at-rule preludes and comments left out). */
function selectors(css: string): string[] {
  const out: string[] = []
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of text.matchAll(/(?<=^|[{}])([^{}]*)\{/g)) {
    const prelude = (m[1] ?? '').trim()
    if (!prelude || prelude.startsWith('@')) continue
    let depth = 0
    let cur = ''
    for (const ch of prelude) {
      if (ch === '(' || ch === '[') depth++
      if (ch === ')' || ch === ']') depth--
      if (ch === ',' && depth === 0) {
        out.push(cur.trim())
        cur = ''
      } else cur += ch
    }
    out.push(cur.trim())
  }
  return out
}

const files = readdirSync(STYLES)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ file: f, css: readFileSync(join(STYLES, f), 'utf8') }))
  .filter(({ css }) => BANNER.test(css))

describe('Figma storefront restyles', () => {
  it('are found in the section stylesheets', () => {
    expect(files.map((f) => f.file)).toEqual(
      expect.arrayContaining(['section-hero-carousel.css', 'section-header.css']),
    )
  })

  it.each(files)('$file: every rule after the banner skips imported Liquid sections', ({ css }) => {
    const after = css.slice(css.search(BANNER))
    const list = selectors(after)
    expect(list.length).toBeGreaterThan(0)
    expect(list.filter((s) => !s.replace(/::[a-z-]+$/, '').endsWith(GUARD))).toEqual([])
  })

  it('reads selectors the way the check needs', () => {
    expect(
      selectors('/* a, b */ .a, .b:not(.c, .d) {x:1} @media (min-width: 1px) { .e::before {y:2} }'),
    ).toEqual(['.a', '.b:not(.c, .d)', '.e::before'])
  })
})
