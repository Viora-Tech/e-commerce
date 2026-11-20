import { describe, expect, it } from 'vitest'
import {
  type ImportedPlace,
  type ImportedTheme,
  importedSections,
  matchesImported,
  newImportedSection,
  sectionTypeCounts,
  shopifyTemplateName,
} from './imported-sections'

const theme: ImportedTheme = {
  schemaLocale: { sections: { ticker: { name: 'Ticker bar' } } },
  blockSchemas: { slide: { settings: [{ type: 'text', id: 'caption', default: 'Hello' }] } },
  schemas: {
    header: { name: 'Header', settings: [] },
    hero: {
      name: 'Hero banner',
      settings: [
        { type: 'text', id: 'heading', default: 'Welcome' },
        { type: 'checkbox', id: 'full_width' },
        { type: 'header', content: 'Layout' },
        { type: 'text', id: 'id', default: 'x' },
      ],
      blocks: [{ type: 'button', settings: [{ type: 'text', id: 'label', default: 'Shop' }] }],
      presets: [
        {
          name: 'Hero banner',
          settings: { heading: 'Big sale' },
          blocks: [{ type: 'button', settings: { label: 'Go' } }, { type: 'slide' }],
        },
      ],
    },
    ticker: {
      name: 't:sections.ticker.name',
      presets: [
        {
          blocks: { a: { type: 'slide' }, b: { type: 'slide', settings: { caption: 'Two' } } },
          block_order: ['b', 'a'],
        } as never,
      ],
    },
    plain: { name: 'No preset', presets: [] },
  },
}

describe('importedSections', () => {
  it('lists only sections with a preset, by name, in the theme words', () => {
    expect(importedSections(theme)).toEqual([
      { type: 'hero', preset: 0, name: 'Hero banner' },
      { type: 'ticker', preset: 0, name: 'Ticker bar' },
    ])
  })

  it('lists every preset of a section under its own name', () => {
    const twoPresets: ImportedTheme = {
      ...theme,
      schemas: { cols: { name: 'Columns', presets: [{ name: 'Two columns' }, {}] } },
    }
    expect(importedSections(twoPresets)).toEqual([
      { type: 'cols', preset: 1, name: 'Columns' },
      { type: 'cols', preset: 0, name: 'Two columns' },
    ])
    expect(newImportedSection(twoPresets, 'cols', 0)?.props._name).toBe('Two columns')
    expect(newImportedSection(twoPresets, 'cols', 2)).toBeNull()
  })

  it('follows enabled_on, disabled_on and limit for the place it adds to', () => {
    const placed: ImportedTheme = {
      ...theme,
      schemas: {
        bar: { name: 'Bar', presets: [{}], enabled_on: { groups: ['header'] } },
        info: { name: 'Info', presets: [{}], enabled_on: { templates: ['product'] } },
        promo: { name: 'Promo', presets: [{}], disabled_on: { groups: ['*'] } },
        once: { name: 'Once', presets: [{}], limit: 1 },
      },
    }
    const typesAt = (place: ImportedPlace, counts?: Map<string, number>) =>
      importedSections(placed, { place, counts }).map((s) => s.type)
    expect(typesAt({ template: 'index' })).toEqual(['once', 'promo'])
    expect(typesAt({ template: 'product' })).toEqual(['info', 'once', 'promo'])
    expect(typesAt({ group: 'header' })).toEqual(['bar', 'once'])
    expect(typesAt({ group: 'footer' })).toEqual(['once'])
    expect(typesAt({ template: 'index' }, new Map([['once', 1]]))).toEqual(['promo'])
  })

  it('counts imported sections by type and names our templates as Shopify does', () => {
    const counts = sectionTypeCounts([
      { type: 'LiquidSection', props: { id: 'a', sectionType: 'hero' } },
      { type: 'LiquidSection', props: { id: 'b', sectionType: 'hero' } },
      { type: 'RichText', props: { id: 'c' } },
    ] as never)
    expect([...counts]).toEqual([['hero', 2]])
    expect(shopifyTemplateName('home')).toBe('index')
    expect(shopifyTemplateName('product')).toBe('product')
  })

  it('matches on the name or the file name', () => {
    const hero = { type: 'hero', preset: 0, name: 'Hero banner' }
    expect(matchesImported(hero, 'banner')).toBe(true)
    expect(matchesImported(hero, 'hero')).toBe(true)
    expect(matchesImported(hero, 'ticker')).toBe(false)
    expect(matchesImported(hero, '')).toBe(true)
  })
})

describe('newImportedSection', () => {
  it('starts from the schema defaults, then the preset, and keeps reserved ids safe', () => {
    const section = newImportedSection(theme, 'hero')
    expect(section?.type).toBe('LiquidSection')
    expect(section?.props).toMatchObject({
      sectionType: 'hero',
      sectionKey: 'hero',
      _name: 'Hero banner',
      heading: 'Big sale',
      // A setting named like one of our own props is stored under a prefix.
      setting_id: 'x',
    })
    expect(section?.props.id).toBe('LiquidSection-hero')
  })

  it('builds the preset blocks with their own defaults, theme blocks included', () => {
    const blocks = newImportedSection(theme, 'hero')?.props.blocks
    expect(blocks).toEqual([
      { id: 'button-1', type: 'button', settings: { label: 'Go' } },
      { id: 'slide-2', type: 'slide', settings: { caption: 'Hello' } },
    ])
  })

  it('reads the map form of preset blocks in block_order', () => {
    const blocks = newImportedSection(theme, 'ticker')?.props.blocks
    expect(blocks).toEqual([
      { id: 'slide-1', type: 'slide', settings: { caption: 'Two' } },
      { id: 'slide-2', type: 'slide', settings: { caption: 'Hello' } },
    ])
  })

  it('is null for a section without a preset, or one the theme does not have', () => {
    expect(newImportedSection(theme, 'header')).toBeNull()
    expect(newImportedSection(theme, 'plain')).toBeNull()
    expect(newImportedSection(theme, 'nope')).toBeNull()
  })
})
