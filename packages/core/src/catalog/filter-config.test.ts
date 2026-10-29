/** SOURCE OF TRUTH: storefront filter settings tests — the default filters each surface showed before settings, a chosen order with names, tag groups (`hand-large` → Hand: Large) and their URL params, and stored settings that no longer read. No database */
import { describe, expect, it } from 'vitest'
import {
  activeFilters,
  browseHref,
  EMPTY_FILTERS,
  hasActiveFilters,
  parseBrowseFilters,
  pickedValues,
  withValues,
} from './browse-params'
import {
  type FilterFacets,
  readFilterConfig,
  resolveFilterGroups,
  tagGroupValues,
  tagPrefixes,
  tagValueLabel,
} from './filter-config'

const FACETS: FilterFacets = {
  inStock: 3,
  outOfStock: 1,
  giftCards: 0,
  products: 4,
  priceMax: 899_900,
  productTypes: [{ value: 'Mouse', count: 4 }],
  vendors: [
    { value: 'ATK', count: 2 },
    { value: 'Lamzu', count: 2 },
  ],
  tags: [
    { value: 'hand-large', count: 2 },
    { value: 'hand-small', count: 1 },
    { value: 'pad-xl', count: 2 },
    { value: 'weight-ultralight', count: 3 },
    { value: 'new', count: 1 },
  ],
  options: [{ key: 'colour', name: 'Colour', values: [{ value: 'Black', count: 4 }] }],
  metafields: [
    {
      key: 'custom.filter_grip',
      name: 'Grip',
      type: 'list',
      values: [{ value: 'Claw', count: 2 }],
    },
  ],
}

describe('resolveFilterGroups', () => {
  it('keeps each surface’s filters when the store has no settings', () => {
    expect(resolveFilterGroups(FACETS, null, 'theme').map((g) => g.id)).toEqual([
      'availability',
      'price',
      'option:colour',
      'metafield:custom.filter_grip',
      'vendor',
      'tags',
    ])
    expect(resolveFilterGroups(FACETS, null, 'liquid').map((g) => g.id)).toEqual([
      'availability',
      'price',
      'option:colour',
      'metafield:custom.filter_grip',
      'vendor',
    ])
  })

  it('follows the settings: order, names, tag groups, and drops groups with nothing to pick', () => {
    const groups = resolveFilterGroups(
      FACETS,
      {
        groups: [
          { source: 'tagGroup', key: 'hand', label: 'Hand size' },
          { source: 'tagGroup', key: 'weight' },
          { source: 'tagGroup', key: 'switch' },
          { source: 'productType' },
          { source: 'metafield', key: 'custom.missing' },
          { source: 'price', label: 'Budget' },
        ],
      },
      'liquid',
    )
    expect(groups.map((g) => [g.id, g.label, g.param])).toEqual([
      ['tagGroup:hand', 'Hand size', 'filter.p.tag.hand'],
      ['tagGroup:weight', 'Weight', 'filter.p.tag.weight'],
      ['productType', null, 'filter.p.product_type'],
      ['price', 'Budget', 'filter.v.price'],
    ])
    expect(groups[0]?.values.map((v) => v.label)).toEqual(['Large', 'Small'])
  })
})

describe('tag groups', () => {
  it('reads values after the prefix and names them for shoppers', () => {
    expect(tagGroupValues(FACETS.tags, 'pad')).toEqual([{ value: 'xl', count: 2 }])
    expect(tagValueLabel('xl')).toBe('XL')
    expect(tagValueLabel('ultralight')).toBe('Ultralight')
    expect(tagValueLabel('tkl-or-full')).toBe('TKL or Full')
    expect(tagPrefixes(FACETS.tags).map((p) => p.prefix)).toEqual(['hand', 'weight', 'pad'])
  })

  it('parses, writes and removes `filter.p.tag.<prefix>` params', () => {
    const f = parseBrowseFilters({
      'filter.p.tag.hand': ['large', 'small'],
      'filter.p.tag.Bad Prefix!': 'x',
      'filter.p.tag': 'new',
    })
    expect(f.tagGroups).toEqual({ hand: ['large', 'small'] })
    expect(f.tags).toEqual(['new'])
    expect(hasActiveFilters({ ...EMPTY_FILTERS, tagGroups: { hand: ['large'] } })).toBe(true)
    expect(
      browseHref('/collections/all', { filters: { ...EMPTY_FILTERS, tagGroups: f.tagGroups } }),
    ).toBe('/collections/all?filter.p.tag.hand=large&filter.p.tag.hand=small')
    const chip = activeFilters(f).find((c) => c.kind === 'tagGroup:hand')
    expect(chip?.without.tagGroups).toEqual({ hand: ['small'] })
    const slot = { field: 'tagGroups' as const, key: 'hand' }
    expect(pickedValues(f, slot)).toEqual(['large', 'small'])
    expect(withValues(f, slot, []).tagGroups).toEqual({})
  })
})

describe('readFilterConfig', () => {
  it('drops repeats and reads nothing that no longer parses', () => {
    expect(
      readFilterConfig({
        groups: [
          { source: 'price' },
          { source: 'price', label: 'Again' },
          { source: 'tagGroup', key: 'hand', label: '' },
        ],
      }),
    ).toEqual({ groups: [{ source: 'price' }, { source: 'tagGroup', key: 'hand' }] })
    expect(readFilterConfig({ groups: [{ source: 'option' }] })).toBeNull()
    expect(readFilterConfig(undefined)).toBeNull()
  })
})
