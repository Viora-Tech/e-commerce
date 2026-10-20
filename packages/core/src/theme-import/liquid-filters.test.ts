/** SOURCE OF TRUTH: Liquid storefront filter tests — `liquidFilters` (Shopify's filter / filter_value shapes, add and remove links, booleans, price ranges) and `collection.filters`, `collection.products` and `search` on their own pages, rendered through the real engine on fake data. No database */
import { describe, expect, it } from 'vitest'
import { FIXTURE_PRODUCT, fakeDataSource } from '../../test/theme-import-fixture'
import type { BrowseFacets } from '../catalog/browse'
import { EMPTY_FILTERS } from '../catalog/browse-params'
import { buildThemeBundle } from './bundle'
import type { LiquidDataSource } from './drops'
import { liquidFilters } from './liquid-filters'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const FACETS: BrowseFacets = {
  inStock: 3,
  outOfStock: 1,
  priceMin: 99_900,
  priceMax: 899_900,
  productTypes: [],
  vendors: [
    { value: 'Pulsar', count: 2 },
    { value: 'Lamzu', count: 2 },
  ],
  tags: [{ value: 'new', count: 1 }],
  options: [],
  metafields: [
    {
      key: 'custom.filter_grip',
      name: 'Grip',
      type: 'list',
      values: [
        { value: 'Claw', count: 2 },
        { value: 'Palm', count: 1 },
      ],
    },
    {
      key: 'custom.wireless',
      name: 'Wireless',
      type: 'boolean',
      values: [
        { value: '1', count: 3 },
        { value: '0', count: 1 },
      ],
    },
  ],
}

describe('liquidFilters', () => {
  const picked = { ...EMPTY_FILTERS, metafields: { 'custom.filter_grip': ['Claw'] } }
  const filters = liquidFilters(FACETS, picked, { path: '/collections/mice' })
  const by = (param: string) => filters.find((f) => f.param_name === param)

  it("lists Shopify's filters in order: availability, price, extra fields, brand", () => {
    expect(filters.map((f) => [f.label, f.type])).toEqual([
      ['Availability', 'list'],
      ['Price', 'price_range'],
      ['Grip', 'list'],
      ['Wireless', 'boolean'],
      ['Brand', 'list'],
    ])
  })

  it('marks picked values and links to add or remove each', () => {
    const grip = by('filter.p.m.custom.filter_grip')
    const claw = grip?.values.find((v) => v.value === 'Claw')
    const palm = grip?.values.find((v) => v.value === 'Palm')
    expect(claw).toMatchObject({
      active: true,
      count: 2,
      param_name: 'filter.p.m.custom.filter_grip',
    })
    expect(claw?.url_to_remove).toBe('/collections/mice')
    expect(palm?.active).toBe(false)
    expect(palm?.url_to_add).toBe(
      '/collections/mice?filter.p.m.custom.filter_grip=Claw&filter.p.m.custom.filter_grip=Palm',
    )
    expect(grip?.active_values.map((v) => v.value)).toEqual(['Claw'])
    expect(grip?.url_to_remove).toBe('/collections/mice')
  })

  it('gives a yes/no field its true and false values', () => {
    const wireless = by('filter.p.m.custom.wireless')
    expect(wireless?.true_value?.label).toBe('Yes')
    expect(wireless?.false_value?.label).toBe('No')
  })

  it('reads the price range in paise, as Shopify reads cents', () => {
    const price = liquidFilters(
      FACETS,
      { ...EMPTY_FILTERS, priceMin: 100_000 },
      { path: '/search', q: 'mouse' },
    ).find((f) => f.type === 'price_range')
    expect(price).toMatchObject({
      range_max: 899_900,
      min_value: { param_name: 'filter.v.price.gte', value: 100_000 },
      max_value: { param_name: 'filter.v.price.lte', value: null },
      url_to_remove: '/search?q=mouse',
    })
  })
})

let themes = 0

async function renderPage(
  source: string,
  template: 'collection' | 'search',
  path: string,
  listing: Record<string, string[]>,
) {
  const calls: unknown[] = []
  const base = fakeDataSource({
    collections: [
      {
        id: '01a0def6-6000-7000-8000-000000000001',
        handle: 'mice',
        title: 'Mice',
        descriptionHtml: '',
        image: null,
        productsCount: 9,
      },
    ],
  })
  const data: LiquidDataSource = {
    ...base,
    browse: async (input) => {
      calls.push(input)
      return {
        products: [FIXTURE_PRODUCT],
        total: 1,
        facets: FACETS,
        filters: { ...EMPTY_FILTERS, metafields: { 'custom.filter_grip': ['Claw'] } },
        sort: 'manual',
        q: String(input.query.q?.[0] ?? ''),
      }
    },
  }
  const bundle = buildThemeBundle({
    themeId: `liquid-filters-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/probe.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data,
    request: {
      template,
      path,
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: '',
      listing,
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  const html = await renderLiquidSection(ctx, {
    id: 'probe',
    type: 'probe',
    settings: {},
    blocks: [],
    location: 'template',
    index: 0,
  })
  return { html: html.trim(), calls }
}

describe('collection.filters and search on their pages', () => {
  it("filters the collection's own products and draws its filters", async () => {
    const { html, calls } = await renderPage(
      `{{ collection.products_count }}|{% for p in collection.products %}{{ p.handle }}{% endfor %}|{% for f in collection.filters %}{{ f.label }}:{{ f.active_values.size }};{% endfor %}`,
      'collection',
      '/collections/mice',
      { 'filter.p.m.custom.filter_grip': ['Claw'] },
    )
    expect(html).toBe('1|mouse|Availability:0;Price:0;Grip:1;Wireless:0;Brand:0;')
    expect(calls).toEqual([
      {
        collectionId: '01a0def6-6000-7000-8000-000000000001',
        query: { 'filter.p.m.custom.filter_grip': ['Claw'] },
        perPage: 50,
      },
    ])
  })

  it('leaves a collection unfiltered and its listing unread off its own page', async () => {
    const { html, calls } = await renderPage(
      `{{ collections.mice.products_count }}|{{ collections.mice.filters.size }}`,
      'collection',
      '/collections/mice',
      {},
    )
    expect(html).toBe('9|0')
    expect(calls).toEqual([])
  })

  it('answers search with its terms, results and filters', async () => {
    const { html } = await renderPage(
      `{{ search.performed }}|{{ search.terms }}|{{ search.results_count }}|{% for r in search.results %}{{ r.handle }}{% endfor %}|{{ search.filters.size }}`,
      'search',
      '/search',
      { q: ['mouse'] },
    )
    expect(html).toBe('true|mouse|1|mouse|5')
  })

  it('reads as not performed without terms', async () => {
    const { html, calls } = await renderPage(
      `{{ search.performed }}|{{ search.results_count }}`,
      'search',
      '/search',
      {},
    )
    expect(html).toBe('false|0')
    expect(calls).toEqual([])
  })
})
