import { describe, expect, it } from 'vitest'
import {
  MAX_SECTIONS,
  requestedSections,
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
  it('rewrites to the section route with the page path and keeps the page query', () => {
    const url = new URL(
      'https://shop.test/-s/store-1/collections/all?filter.v.availability=1&section_id=guide-results',
    )
    expect(toSectionRendering(url, 'store-1', 'GET', '/collections/all')).toBe(true)
    expect(url.pathname).toBe('/-s/store-1/theme-actions/section')
    expect(url.searchParams.get('path')).toBe('/collections/all')
    expect(url.searchParams.get('filter.v.availability')).toBe('1')
    expect(url.searchParams.get('section_id')).toBe('guide-results')
  })

  it('takes the unprefixed page path over a path the visitor sent', () => {
    const url = new URL('https://shop.test/-s/store-1/collections/mice?path=/admin&section_id=a')
    toSectionRendering(url, 'store-1', 'GET', '/collections/mice')
    expect(url.searchParams.getAll('path')).toEqual(['/collections/mice'])
  })

  it('leaves a page request without section params unchanged', () => {
    const url = new URL('https://shop.test/-s/store-1/collections/all?page=2')
    expect(toSectionRendering(url, 'store-1', 'GET', '/collections/all')).toBe(false)
    expect(url.pathname).toBe('/-s/store-1/collections/all')
    expect(url.searchParams.has('path')).toBe(false)
  })
})
