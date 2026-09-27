import { describe, expect, it } from 'vitest'
import { SECTION_ICONS } from './customize-puck'
import { KIND_TILE, sectionGlyph, sectionKind } from './customize-section-kinds'

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
