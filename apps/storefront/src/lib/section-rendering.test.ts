import { describe, expect, it } from 'vitest'
import { DERIVED_HEADERS, SECTION_PATH_HEADER } from './routing'
import {
  MAX_SECTIONS,
  requestedSections,
  sectionPagePath,
  sectionRenderingPath,
  toSectionRendering,
  validSectionId,
} from './section-rendering'

describe('requestedSections', () => {
  it('lists each section once, in order, trimmed', () => {
    expect(requestedSections('header, cart-drawer,,header')).toEqual(['header', 'cart-drawer'])
  })

  it('caps the list as Shopify does', () => {
    const many = Array.from({ length: 8 }, (_, i) => `s${i}`).join(',')
    expect(requestedSections(many)).toHaveLength(MAX_SECTIONS)
  })

  it('is empty for an empty list', () => {
    expect(requestedSections('')).toEqual([])
    expect(requestedSections(' , ')).toEqual([])
  })
})

describe('validSectionId', () => {
  it('takes theme section names only', () => {
    expect(validSectionId('main-cart_items-2')).toBe(true)
    expect(validSectionId('../layout/theme')).toBe(false)
    expect(validSectionId('')).toBe(false)
    expect(validSectionId('a'.repeat(81))).toBe(false)
  })
})

describe('sectionRenderingPath', () => {
  const STORE = 'store-1'
  const ask = (pathname: string, query: string, method = 'GET') =>
    sectionRenderingPath(STORE, method, pathname, new URLSearchParams(query))

  it('sends a page asking for one section, or a list, to the section route', () => {
    const route = '/-s/store-1/theme-actions/section'
    expect(ask('/collections/all', 'filter.v.availability=1&section_id=guide-results')).toBe(route)
    expect(ask('/', 'sections=header,footer')).toBe(route)
    expect(ask('/products/mouse', 'section_id=main-product', 'HEAD')).toBe(route)
  })

  it('leaves a plain page, a form post and the routes that answer it themselves alone', () => {
    expect(ask('/collections/all', 'filter.v.availability=1')).toBeNull()
    expect(ask('/collections/all', 'section_id=x', 'POST')).toBeNull()
    expect(ask('/search/suggest', 'q=mouse&section_id=predictive-search')).toBeNull()
    expect(ask('/recommendations/products', 'product_id=1&section_id=related')).toBeNull()
    expect(ask('/theme-actions/section', 'path=/&section_id=x')).toBeNull()
    expect(ask('/checkout/information', 'section_id=x')).toBeNull()
    expect(ask('/account', 'section_id=x')).toBeNull()
    expect(ask('/products/mouse.json', 'section_id=x')).toBeNull()
  })
})

describe('toSectionRendering', () => {
  const page = (query: string) => new URL(`https://shop.test/-s/store-1/collections/all?${query}`)

  it('rewrites to the section route and hands the page path on in a header', () => {
    const url = page('filter.v.availability=1&section_id=guide-results')
    const headers = new Headers()
    expect(toSectionRendering(url, headers, 'store-1', 'GET', '/collections/all')).toBe(true)
    expect(url.pathname).toBe('/-s/store-1/theme-actions/section')
    expect(url.searchParams.get('filter.v.availability')).toBe('1')
    expect(url.searchParams.get('section_id')).toBe('guide-results')
    expect(headers.get(SECTION_PATH_HEADER)).toBe('/collections/all')
  })

  it('leaves a page request without section params unchanged', () => {
    const url = page('page=2')
    const headers = new Headers()
    expect(toSectionRendering(url, headers, 'store-1', 'GET', '/collections/all')).toBe(false)
    expect(url.pathname).toBe('/-s/store-1/collections/all')
    expect(headers.has(SECTION_PATH_HEADER)).toBe(false)
  })
})

describe('sectionPagePath', () => {
  // A route handler reached by the proxy's rewrite sees the URL the visitor asked for, without
  // any query the rewrite added: the page path has to come from the header (bug on 22 Nov:
  // `/collections/all?section_id=guide-results` rendered on the home page, count 0).
  it('reads the proxy header on the URL the visitor asked for', () => {
    const req = new Request('https://shop.test/collections/all?section_id=guide-results', {
      headers: { [SECTION_PATH_HEADER]: '/collections/all' },
    })
    expect(sectionPagePath(req)).toBe('/collections/all')
  })

  it("falls back to the shim's ?path=, then the home page", () => {
    expect(
      sectionPagePath(
        new Request('https://shop.test/theme-actions/section?path=/collections/mice'),
      ),
    ).toBe('/collections/mice')
    expect(sectionPagePath(new Request('https://shop.test/theme-actions/section'))).toBe('/')
  })

  it('never trusts the header from a visitor: the proxy strips it', () => {
    expect(DERIVED_HEADERS).toContain(SECTION_PATH_HEADER)
  })
})
