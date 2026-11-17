import { describe, expect, it } from 'vitest'
import { sourceHash } from '../../../../scripts/storefront-css/sections-css.mjs'
import { needsSectionStyles, sectionStylesFile, sectionStylesHref } from './section-styles'
import { SECTION_STYLES_SOURCE_HASH } from './section-styles.generated'

describe('section styles', () => {
  it('is built from the current sections.css files (else run `bun run css:sections`)', () => {
    expect(SECTION_STYLES_SOURCE_HASH).toBe(sourceHash())
  })

  it('an imported theme page with only main and Liquid sections skips the file', () => {
    expect(needsSectionStyles(['LiquidSection', 'MainProduct', 'RecentlyViewed'])).toBe(false)
    expect(needsSectionStyles([])).toBe(false)
  })

  it('any of our other sections on the page links it', () => {
    expect(needsSectionStyles(['LiquidSection', 'HeroCarousel'])).toBe(true)
  })

  it('serves the current version for a year and an old one briefly', () => {
    const v = new URL(sectionStylesHref(), 'https://x.test').searchParams.get('v')
    expect(sectionStylesFile(v).current).toBe(true)
    expect(sectionStylesFile('old').current).toBe(false)
    expect(sectionStylesFile(v).css).toContain('.hero-carousel')
  })
})
