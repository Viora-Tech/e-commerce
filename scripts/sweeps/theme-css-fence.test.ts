/**
 * Sweep: our theme's stylesheets (`packages/blocks/src/styles`) load on every storefront page,
 * an imported Shopify theme's included, and many class names are the same in both
 * (`product-card__quick-add`, `header__logo`…). A rule driven by one of OUR theme settings
 * (`:root[data-card-quick-add="on"]`, `:root[data-theme="dark"]`…) must not reach an imported
 * theme's sections: the merchant set the imported theme's own settings, not ours, so ours sit
 * at their defaults and hid, for example, every imported product card's quick-add button (#1046).
 *
 * Rule: every selector that reads a `:root[data-*]` / `:root:not([data-*])` attribute ends with
 * `:not(:where(.shopify-section *))`, the same fence the plain rules use (`.shopify-section` is
 * the wrapper the Liquid renderer puts round each imported section, theme-import/render.ts).
 * Not a ratchet: there is no allow-list, so a new unfenced rule fails.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

const STYLES = path.join(ROOT, 'packages/blocks/src/styles')
const FENCE = ':not(:where(.shopify-section *))'
const READS_OUR_SETTING = /:root(\[data-|:not\(\[data-)/

/** Each rule's selector list in a stylesheet, comments removed, nested at-rules flattened. */
function selectorsOf(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: string[] = []
  for (const m of text.matchAll(/([^{};]+)\{/g)) {
    const prelude = (m[1] ?? '').trim()
    if (prelude.startsWith('@')) continue
    for (const s of prelude.split(',')) found.push(s.replace(/\s+/g, ' ').trim())
  }
  return found
}

/** Selectors reading one of our theme settings that would still reach an imported section. */
export function unfencedSelectors(css: string): string[] {
  return selectorsOf(css).filter((s) => READS_OUR_SETTING.test(s) && !s.endsWith(FENCE))
}

describe('sweep: theme-css-fence', () => {
  it('finds an unfenced rule and accepts a fenced one', () => {
    expect(unfencedSelectors(':root[data-x="on"] .a { color: red }')).toEqual([':root[data-x="on"] .a'])
    expect(unfencedSelectors(`:root[data-x="on"] .a${FENCE} { color: red }`)).toEqual([])
    expect(unfencedSelectors('/* :root[data-x] .a { */ .b { color: red }')).toEqual([])
  })

  it('every rule reading our theme settings is fenced off imported Shopify sections', () => {
    const offenders = readdirSync(STYLES)
      .filter((f) => f.endsWith('.css'))
      .flatMap((f) =>
        unfencedSelectors(readFileSync(path.join(STYLES, f), 'utf8')).map((s) => `${f}: ${s}`),
      )
    expect(offenders, `append ${FENCE} to each selector (see docs/guardrails.md)`).toEqual([])
  })
})
