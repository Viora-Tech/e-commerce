import { describe, expect, it } from 'vitest'
import {
  brokenLinkPath,
  brokenLinkReferrer,
  handleSimilarity,
  shouldLogBrokenLink,
  suggestRedirect,
} from './broken-links'

describe('shouldLogBrokenLink', () => {
  it('logs page-like paths people and search engines expect', () => {
    for (const path of [
      '/products/old-tee',
      '/collections/summer-sale',
      '/pages/about-us',
      '/products/talongames-%E5%B9%BB-maboroshi-series-gaming-mousepad',
      '/blogs/news/launch-day',
    ]) {
      expect(shouldLogBrokenLink(path), path).toBe(true)
    }
  })

  it('skips the junk Googlebot lifted out of our scripts (Search Console, Nov 2026)', () => {
    for (const path of [
      '/z3oF6Ceu76Y4U3F6bpjNw==',
      '/p/rTkb+N5jFDLtEGNIoWw==',
      '/PcFBwC3+4Fcl7SdViaL5nWGFY744XgP',
      '/AcGBwLTz1V5h4euRWaIp3eHdwt1W2AC',
      '/${t}',
      '/%24%7Bt%7D',
      '/b',
      '/Gz7eMAXYijIpgCw6LL35_A',
      '/Gz7e-AXYijIpgCw6LL35_A',
    ]) {
      expect(shouldLogBrokenLink(path), path).toBe(false)
    }
  })

  it('skips assets, endpoints and probes', () => {
    for (const path of [
      '/',
      '/api/beacon',
      '/_next/static/chunks/a.js',
      '/theme-assets/x/cart.js',
      '/theme-actions/cart-add',
      '/cdn-cgi/rum',
      '/videos/hero/index.m3u8',
      '/assets/app.css',
      '/logo.png',
      '/wp-login.php',
      '/wp-admin',
      `/products/${'a'.repeat(400)}`,
    ]) {
      expect(shouldLogBrokenLink(path), path).toBe(false)
    }
  })

  it('ignores the query string', () => {
    expect(shouldLogBrokenLink('/products/old-tee?variant=1')).toBe(true)
  })
})

describe('brokenLinkPath and brokenLinkReferrer', () => {
  it('stores the redirect form of the path', () => {
    expect(brokenLinkPath('/Products/Old-Tee/')).toBe('/products/old-tee')
    expect(brokenLinkPath('/products/t-%E5%B9%BB')).toBe('/products/t-幻')
  })

  it('keeps only the origin and path of a referrer', () => {
    expect(brokenLinkReferrer('https://www.google.com/search?q=secret')).toBe(
      'https://www.google.com/search',
    )
    expect(brokenLinkReferrer('android-app://com.google')).toBeNull()
    expect(brokenLinkReferrer('not a url')).toBeNull()
    expect(brokenLinkReferrer(null)).toBeNull()
  })
})

describe('suggestRedirect', () => {
  const options = [
    { kind: 'product' as const, handle: 'talongames-series-gaming-mousepad' },
    { kind: 'product' as const, handle: 'pulsar-x2-mini' },
    { kind: 'collection' as const, handle: 'gaming-mousepads' },
    { kind: 'collection' as const, handle: 'pulsar-x2-mini' },
  ]

  it('finds the product an old Shopify handle became', () => {
    expect(
      suggestRedirect('/products/talongames-幻-maboroshi-series-gaming-mousepad', options)?.target,
    ).toBe('/products/talongames-series-gaming-mousepad')
  })

  it('prefers the kind the path names', () => {
    expect(suggestRedirect('/products/pulsar-x2-mini', options)?.target).toBe(
      '/products/pulsar-x2-mini',
    )
    expect(suggestRedirect('/collections/pulsar-x2-mini', options)?.target).toBe(
      '/collections/pulsar-x2-mini',
    )
  })

  it('suggests nothing when no handle is close', () => {
    expect(suggestRedirect('/products/blue-cotton-shirt', options)).toBeNull()
    expect(suggestRedirect('/', options)).toBeNull()
  })

  it('scores word overlap', () => {
    expect(handleSimilarity('a-b-c', 'a-b-c')).toBe(1)
    expect(handleSimilarity('a-b', 'c-d')).toBe(0)
  })
})
