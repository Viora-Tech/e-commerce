/** SOURCE OF TRUTH: extra-field (metafield) filter tests — Shopify's `filter.p.m.<namespace>.<key>` params parsed, written back and removed as chips, and which fields read as filters. No database */
import { describe, expect, it } from 'vitest'
import { metafieldFacets } from './browse'
import {
  activeFilters,
  browseHref,
  EMPTY_FILTERS,
  hasActiveFilters,
  parseBrowseFilters,
} from './browse-params'

describe('metafield filter params', () => {
  it("parses Shopify's metafield filters into stored keys", () => {
    const f = parseBrowseFilters({
      'filter.p.m.custom.filter_grip': ['Claw', 'Palm', 'Claw'],
      'filter.p.m.custom.hand-size': 'Large',
      'filter.p.m.shopify--discovery.thing': 'x',
      'filter.p.m.custom': 'no key',
      'filter.p.m.custom.empty': ' ',
    })
    expect(f.metafields).toEqual({
      'custom.filter_grip': ['Claw', 'Palm'],
      'custom.hand_size': ['Large'],
      'shopify_discovery.thing': ['x'],
    })
    expect(hasActiveFilters(f)).toBe(true)
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('writes them back into the URL and removes one value as a chip', () => {
    const f = { ...EMPTY_FILTERS, metafields: { 'custom.filter_grip': ['Claw', 'Palm'] } }
    expect(browseHref('/collections/mice', { filters: f })).toBe(
      '/collections/mice?filter.p.m.custom.filter_grip=Claw&filter.p.m.custom.filter_grip=Palm',
    )
    const chips = activeFilters(f)
    expect(chips.map((c) => c.value)).toEqual(['Claw', 'Palm'])
    expect(chips[0]?.without.metafields).toEqual({ 'custom.filter_grip': ['Palm'] })
    expect(activeFilters({ ...EMPTY_FILTERS, metafields: { 'custom.x': ['a'] } })[0]?.without.metafields).toEqual({})
  })
})

describe('metafieldFacets', () => {
  const row = (field: string, value: string, count: number, name = field) => ({
    field,
    name,
    value,
    count,
  })

  it('keeps fields whose values repeat across products, values A to Z', () => {
    const facets = metafieldFacets([
      row('custom.filter_grip', 'Palm', 4, 'Grip'),
      row('custom.filter_grip', 'Claw', 6, 'Grip'),
      row('custom.spec_sensor', 'PAW3395', 1),
      row('custom.spec_sensor', 'PAW3950', 1),
      row('custom.only', 'One', 9),
    ])
    expect(facets).toEqual([
      {
        key: 'custom.filter_grip',
        name: 'Grip',
        values: [
          { value: 'Claw', count: 6 },
          { value: 'Palm', count: 4 },
        ],
      },
    ])
  })

  it('drops a field with too many values to be a filter', () => {
    const many = Array.from({ length: 30 }, (_, i) => row('custom.notes', `Note ${i}`, 2))
    expect(metafieldFacets(many)).toEqual([])
  })
})
