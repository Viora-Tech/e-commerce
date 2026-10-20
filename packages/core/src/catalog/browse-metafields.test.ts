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
  const row = (field: string, value: string, count: number, type = 'single_line_text') => ({
    field,
    name: field === 'custom.filter_grip' ? 'Grip' : field,
    type,
    value,
    count,
  })

  it('groups values per field in field order, values in natural order', () => {
    const facets = metafieldFacets([
      row('custom.filter_grip', 'Palm', 4),
      row('custom.filter_grip', 'Claw', 6),
      row('custom.dpi', '26000', 2, 'number_integer'),
      row('custom.dpi', '8000', 3, 'number_integer'),
      row('custom.dpi', '', 1, 'number_integer'),
    ])
    expect(facets).toEqual([
      {
        key: 'custom.filter_grip',
        name: 'Grip',
        type: 'list',
        values: [
          { value: 'Claw', count: 6 },
          { value: 'Palm', count: 4 },
        ],
      },
      {
        key: 'custom.dpi',
        name: 'custom.dpi',
        type: 'list',
        values: [
          { value: '8000', count: 3 },
          { value: '26000', count: 2 },
        ],
      },
    ])
  })

  it('reads a yes/no field as a boolean filter, yes first', () => {
    const [f] = metafieldFacets([
      row('custom.wireless', '0', 2, 'boolean'),
      row('custom.wireless', '1', 5, 'boolean'),
    ])
    expect(f?.type).toBe('boolean')
    expect(f?.values.map((v) => v.value)).toEqual(['1', '0'])
  })

  it('keeps one value: a filter shows even when every product agrees', () => {
    expect(metafieldFacets([row('custom.only', 'One', 9)])).toHaveLength(1)
  })
})
