import { describe, expect, it } from 'vitest'
import { edgeCacheControl } from './edge-cache'
import { listingSearch } from './routing'
import {
  cloudflareTrackingRewrite,
  hasTrackingParams,
  isTrackingParam,
  TRACKING_PARAMS,
  withoutTrackingParams,
} from './tracking-params'

describe('isTrackingParam', () => {
  it('knows the ad click ids and every utm_ tag', () => {
    for (const p of ['fbclid', 'gclid', 'ttclid', 'msclkid', 'utm_source', 'utm_anything']) {
      expect(isTrackingParam(p), p).toBe(true)
    }
  })

  it('leaves params that change the page, and the affiliate ref, alone', () => {
    for (const p of [
      'ref',
      'q',
      'page',
      'sort_by',
      'variant',
      'filter.v.price.gte',
      'theme-preview',
    ]) {
      expect(isTrackingParam(p), p).toBe(false)
    }
  })
})

describe('withoutTrackingParams', () => {
  it('drops click ids and utm tags, keeps the rest in order', () => {
    expect(withoutTrackingParams('?variant=7&fbclid=IwAR1&utm_source=fb&page=2')).toBe(
      '?variant=7&page=2',
    )
  })

  it('gives an empty search when only tracking params were there', () => {
    expect(withoutTrackingParams('?fbclid=IwAR1&gclid=Cj0')).toBe('')
    expect(withoutTrackingParams('?')).toBe('')
    expect(withoutTrackingParams('')).toBe('')
  })

  it('returns an untouched search as sent', () => {
    expect(withoutTrackingParams('?q=mouse%20pad')).toBe('?q=mouse%20pad')
  })

  it('keeps ref so the affiliate cookie still lands', () => {
    expect(withoutTrackingParams('?ref=ANNA&fbclid=x')).toBe('?ref=ANNA')
  })
})

describe('hasTrackingParams', () => {
  it('spots a click id anywhere in the query', () => {
    expect(hasTrackingParams('?variant=1&gclid=abc')).toBe(true)
    expect(hasTrackingParams('?variant=1')).toBe(false)
  })
})

describe('the origin already ignores tracking params', () => {
  it('a tagged URL gets the same shared cache header as the clean one', () => {
    // edgeCacheControl reads no query at all; the CDN is the only place a click id splits the cache.
    const input = {
      method: 'GET',
      pathname: '/products/mouse',
      cookieNames: ['_fbp', '_ga'],
      rsc: false,
      personal: false,
      ttlSeconds: 300,
    }
    expect(edgeCacheControl(input)).toMatch(/^public, /)
  })

  it('the listing cache key drops them', () => {
    expect(listingSearch(new URLSearchParams('fbclid=a&gclid=b&utm_medium=cpc&page=2'))).toBe(
      'page=2',
    )
  })
})

describe('cloudflareTrackingRewrite', () => {
  const rule = cloudflareTrackingRewrite()

  it('removes every listed param, and only on page GETs', () => {
    for (const p of TRACKING_PARAMS) {
      expect(rule.query).toContain(`"${p}"`)
      expect(rule.expression).toContain(`contains "${p}="`)
    }
    expect(rule.query.startsWith('remove_query_args(http.request.uri.query, ')).toBe(true)
    expect(rule.expression).toContain('http.request.method eq "GET"')
    expect(rule.expression).toContain('not starts_with(http.request.uri.path, "/api/")')
    expect(rule.query).not.toContain('"ref"')
  })

  it("fits Cloudflare's 4096-character expression limit", () => {
    expect(rule.expression.length).toBeLessThan(4096)
    expect(rule.query.length).toBeLessThan(4096)
  })
})
