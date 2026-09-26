import { describe, expect, it } from 'vitest'
import {
  articleHref,
  collectionHref,
  isLinkTextField,
  normalisePastedUrl,
  pageHref,
  parseHref,
  productHref,
} from './customize-links'

describe('storefront paths', () => {
  it('builds the storefront route for each kind', () => {
    expect(productHref('glass-pad')).toBe('/products/glass-pad')
    expect(collectionHref('all')).toBe('/collections/all')
    expect(pageHref('about')).toBe('/pages/about')
    expect(pageHref('home')).toBe('/')
    expect(articleHref('news', 'launch-day')).toBe('/blogs/news/launch-day')
  })

  it('encodes handles', () => {
    expect(productHref('a b')).toBe('/products/a%20b')
  })
})

describe('parseHref', () => {
  it('reads each kind back', () => {
    expect(parseHref('')).toEqual({ kind: 'empty' })
    expect(parseHref(undefined)).toEqual({ kind: 'empty' })
    expect(parseHref('/')).toEqual({ kind: 'home' })
    expect(parseHref('/products/glass-pad')).toEqual({ kind: 'product', handle: 'glass-pad' })
    expect(parseHref('/collections/all')).toEqual({ kind: 'collection', handle: 'all' })
    expect(parseHref('/pages/about')).toEqual({ kind: 'page', handle: 'about' })
    expect(parseHref('/blogs/news/launch-day')).toEqual({
      kind: 'article',
      blog: 'news',
      handle: 'launch-day',
    })
  })

  it('round-trips encoded handles', () => {
    expect(parseHref(productHref('a b'))).toEqual({ kind: 'product', handle: 'a b' })
  })

  it('treats anything else as a plain address', () => {
    expect(parseHref('https://example.com')).toEqual({ kind: 'url', url: 'https://example.com' })
    expect(parseHref('/collections/all?sort=new')).toEqual({
      kind: 'url',
      url: '/collections/all?sort=new',
    })
  })
})

describe('normalisePastedUrl', () => {
  it('keeps paths and adds https to bare domains', () => {
    expect(normalisePastedUrl('/pages/about')).toBe('/pages/about')
    expect(normalisePastedUrl('#faq')).toBe('#faq')
    expect(normalisePastedUrl('example.com/x')).toBe('https://example.com/x')
    expect(normalisePastedUrl('https://example.com')).toBe('https://example.com/')
    expect(normalisePastedUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(normalisePastedUrl('//cdn.example.com/a')).toBe('https://cdn.example.com/a')
  })

  it('refuses unsafe or meaningless input', () => {
    expect(normalisePastedUrl('')).toBeNull()
    expect(normalisePastedUrl('javascript:alert(1)')).toBeNull()
    expect(normalisePastedUrl('hello')).toBeNull()
  })
})

describe('isLinkTextField', () => {
  it('matches href fields and fields labelled Link', () => {
    expect(isLinkTextField({ type: 'text', label: 'Link' })).toBe(true)
    expect(isLinkTextField({ type: 'text', label: 'Button' }, 'cta.href')).toBe(true)
  })

  it('leaves media URLs and other text alone', () => {
    expect(isLinkTextField({ type: 'text', label: 'Image URL' }, 'url')).toBe(false)
    expect(isLinkTextField({ type: 'text', label: 'Video link' }, 'url')).toBe(false)
    expect(isLinkTextField({ type: 'textarea', label: 'Link' })).toBe(false)
  })
})
