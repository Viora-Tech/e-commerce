import { describe, expect, it } from 'vitest'
import { SECTION_ICONS } from './customize-puck'
import { KIND_TILE, sectionGlyph, sectionHandle, sectionKind } from './customize-section-kinds'

describe('sectionKind', () => {
  it('reads app blocks from their namespaced type', () => {
    expect(sectionKind('back-in-stock/NotifyMe')).toBe('app')
  })

  it('files known sections under their kind', () => {
    expect(sectionKind('Header')).toBe('layout')
    expect(sectionKind('RichText')).toBe('text')
    expect(sectionKind('Gallery')).toBe('media')
    expect(sectionKind('FeaturedProduct')).toBe('product')
  })

  it('falls back to layout for a type it does not know', () => {
    expect(sectionKind('SomethingNew')).toBe('layout')
  })

  it('has a tile tint for every kind, built from tokens only', () => {
    for (const tint of Object.values(KIND_TILE)) expect(tint).not.toMatch(/#|rgb|hsl/)
  })
})

describe('sectionGlyph', () => {
  it('uses the add menu glyph for every library section', () => {
    for (const [type, key] of Object.entries(SECTION_ICONS)) expect(sectionGlyph(type)).toBe(key)
  })

  it('names glyphs for main sections, groups and app blocks', () => {
    expect(sectionGlyph('Header')).toBe('header')
    expect(sectionGlyph('MainProduct')).toBe('package')
    expect(sectionGlyph('acme/Widget')).toBe('shapes')
    expect(sectionGlyph('SomethingNew')).toBe('page')
  })
})

describe('imported sections', () => {
  it('pick a glyph and kind from the section file name', () => {
    expect(sectionGlyph('LiquidSection', 'hero-carousel')).toBe('carousel')
    expect(sectionGlyph('LiquidSection', 'logo-carousel')).toBe('shapes')
    expect(sectionGlyph('LiquidSection', 'reviews-showcase')).toBe('quote')
    expect(sectionGlyph('LiquidSection', 'announcement-bar')).toBe('megaphone')
    expect(sectionGlyph('LiquidSection', 'tabbed-products')).toBe('tabs')
    expect(sectionKind('LiquidSection', 'featured-product')).toBe('product')
    expect(sectionKind('LiquidSection', 'header')).toBe('layout')
  })

  it('fall back to the page glyph for a name with no known word', () => {
    expect(sectionGlyph('LiquidSection', 'xyz')).toBe('page')
    expect(sectionGlyph('LiquidSection')).toBe('page')
  })

  it('read the file name from the section props', () => {
    expect(sectionHandle({ props: { sectionType: 'footer' } })).toBe('footer')
    expect(sectionHandle({ props: {} })).toBeUndefined()
  })
})
