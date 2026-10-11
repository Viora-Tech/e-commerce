import { describe, expect, it } from 'vitest'
import { type EdgeCacheInput, edgeCacheControl, isPersonalCookie } from './edge-cache'

const base: EdgeCacheInput = {
  method: 'GET',
  pathname: '/',
  cookieNames: [],
  rsc: false,
  personal: false,
  ttlSeconds: 30,
}

const shared = (patch: Partial<EdgeCacheInput>) => edgeCacheControl({ ...base, ...patch })

describe('edgeCacheControl', () => {
  it('lets a CDN keep catalogue pages for visitors without our cookies', () => {
    const header = 'public, max-age=0, s-maxage=30, stale-while-revalidate=300'
    for (const pathname of [
      '/',
      '/products/mouse',
      '/collections',
      '/collections/mice',
      '/pages/about',
      '/blogs/news',
      '/blogs/news/launch',
      '/policies/refund-policy',
      '/search',
    ]) {
      expect(shared({ pathname }), pathname).toBe(header)
    }
    expect(shared({ method: 'HEAD' })).toBe(header)
    expect(shared({ cookieNames: ['_ga', '_fbp'] })).toBe(header)
  })

  it('keeps personal and transactional pages private', () => {
    for (const pathname of [
      '/cart',
      '/checkout',
      '/checkout/pay/1001',
      '/account',
      '/account/login',
      '/theme-actions/cart-add',
      '/api/search/suggest',
      '/products/mouse/extra',
    ]) {
      expect(shared({ pathname }), pathname).toBeNull()
    }
  })

  it('never shares a page for a visitor with a cart, an account or saved choices', () => {
    for (const name of ['wc_cart', 'wc_customer', 'wc_consent', 'wc_theme_preview', 'theme']) {
      expect(shared({ cookieNames: ['_ga', name] }), name).toBeNull()
    }
    expect(shared({ cookieNames: ['recently_viewed'] })).toBeNull()
  })

  it('never shares a navigation payload, a preview or a post', () => {
    expect(shared({ rsc: true })).toBeNull()
    expect(shared({ personal: true })).toBeNull()
    expect(shared({ method: 'POST' })).toBeNull()
  })

  it('is off with a TTL of 0', () => {
    expect(shared({ ttlSeconds: 0 })).toBeNull()
  })
})

describe('isPersonalCookie', () => {
  it('knows our cookies from everyone else’s', () => {
    expect(isPersonalCookie('wc_vid')).toBe(true)
    expect(isPersonalCookie('theme')).toBe(true)
    expect(isPersonalCookie('_ga')).toBe(false)
  })
})
