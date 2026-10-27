import { describe, expect, it } from 'vitest'
import {
  ACCOUNTS_PREFIX,
  checkoutHostname,
  INTERNAL_PREFIX,
  listingSearch,
  PASSWORD_PREFIX,
  primaryRedirect,
  routeForAccounts,
  routeForCheckoutHost,
  routeForStore,
} from './routing'

describe('routeForStore', () => {
  it('rewrites a public path onto the internal store segment', () => {
    expect(routeForStore('store-a', '/')).toEqual({ kind: 'rewrite', path: '/-s/store-a' })
    expect(routeForStore('store-a', '/products/mouse')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/products/mouse',
    })
  })

  it('refuses direct requests to the internal prefix so one store cannot address another', () => {
    expect(routeForStore('store-a', `${INTERNAL_PREFIX}/store-b/products/mouse`)).toEqual({
      kind: 'forbidden',
    })
    expect(routeForStore('store-a', `${INTERNAL_PREFIX}`)).toEqual({ kind: 'forbidden' })
    expect(routeForStore('store-a', `${PASSWORD_PREFIX}/store-b`)).toEqual({ kind: 'forbidden' })
  })

  it('leaves Next internals and API routes alone', () => {
    expect(routeForStore('store-a', '/_next/static/x.js')).toEqual({ kind: 'passthrough' })
    expect(routeForStore('store-a', '/api/health')).toEqual({ kind: 'passthrough' })
  })
})

describe('primaryRedirect', () => {
  const base = {
    hostname: 'www.brand.in',
    port: '',
    pathname: '/products/glasspad',
    search: '?variant=2',
    protocol: 'https:',
    primaryHostname: 'brand.in',
    redirect: true,
    inFrame: false,
    previewing: false,
    dev: false,
  }

  it('sends a redirecting domain to the primary, keeping path and query', () => {
    expect(primaryRedirect(base)).toBe('https://brand.in/products/glasspad?variant=2')
  })

  it('forces https in production even when the edge forwarded plain http', () => {
    expect(primaryRedirect({ ...base, protocol: 'http:', port: '8080' })).toBe(
      'https://brand.in/products/glasspad?variant=2',
    )
  })

  it('keeps the scheme and port in development', () => {
    expect(
      primaryRedirect({
        ...base,
        dev: true,
        protocol: 'http:',
        port: '3100',
        hostname: 'old.test',
      }),
    ).toBe('http://brand.in:3100/products/glasspad?variant=2')
  })

  it('serves the page when the domain does not redirect, is the primary, or there is none', () => {
    expect(primaryRedirect({ ...base, redirect: false })).toBeNull()
    expect(primaryRedirect({ ...base, hostname: 'brand.in' })).toBeNull()
    expect(primaryRedirect({ ...base, primaryHostname: null })).toBeNull()
  })

  it('never redirects frames, theme previews, APIs or webhooks', () => {
    expect(primaryRedirect({ ...base, inFrame: true })).toBeNull()
    expect(primaryRedirect({ ...base, previewing: true })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: '/api/cart' })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: '/_next/static/x.js' })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: '/webhooks/razorpay' })).toBeNull()
    expect(primaryRedirect({ ...base, pathname: `${INTERNAL_PREFIX}/x` })).toBeNull()
  })
})

describe('routeForAccounts (platform login domain)', () => {
  it('serves only provider sign-in and the Truecaller callback', () => {
    expect(routeForAccounts('/oauth/google/start')).toEqual({
      kind: 'rewrite',
      path: '/-a/oauth/google/start',
    })
    expect(routeForAccounts('/oauth/apple/callback')).toEqual({
      kind: 'rewrite',
      path: '/-a/oauth/apple/callback',
    })
    expect(routeForAccounts('/truecaller/callback')).toEqual({
      kind: 'rewrite',
      path: '/-a/truecaller/callback',
    })
    for (const p of ['/', '/account', '/oauth/github/start', '/oauth/google/start/x', '/-s/x']) {
      expect(routeForAccounts(p)).toEqual({ kind: 'forbidden' })
    }
  })

  it('never lets a store host reach the login domain routes', () => {
    expect(routeForStore('store-a', `${ACCOUNTS_PREFIX}/oauth/google/start`)).toEqual({
      kind: 'forbidden',
    })
  })
})

describe('checkoutHostname', () => {
  it('strips the configured subdomain to the store primary', () => {
    expect(checkoutHostname('checkout.waimers.com', 'checkout')).toBe('waimers.com')
    expect(checkoutHostname('checkout.shop.koomerce.app', 'checkout')).toBe('shop.koomerce.app')
  })
  it('is null when the flag is off or the host is not a checkout host', () => {
    expect(checkoutHostname('waimers.com', 'checkout')).toBeNull()
    expect(checkoutHostname('checkout.waimers.com', null)).toBeNull()
    expect(checkoutHostname('checkout.', 'checkout')).toBeNull()
    expect(checkoutHostname(null, 'checkout')).toBeNull()
  })
})

describe('routeForCheckoutHost', () => {
  it('serves only the hand-off entry and checkout pages', () => {
    expect(routeForCheckoutHost('store-a', '/checkout')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/checkout',
    })
    expect(routeForCheckoutHost('store-a', '/c/tok123')).toEqual({
      kind: 'rewrite',
      path: '/-s/store-a/c/tok123',
    })
    expect(routeForCheckoutHost('store-a', '/checkout/thank-you/42')).toMatchObject({
      kind: 'rewrite',
    })
  })
  it('passes assets and api through, and 404s everything else', () => {
    expect(routeForCheckoutHost('store-a', '/_next/static/x.js')).toEqual({ kind: 'passthrough' })
    expect(routeForCheckoutHost('store-a', '/products/mouse')).toEqual({ kind: 'forbidden' })
    expect(routeForCheckoutHost('store-a', '/')).toEqual({ kind: 'forbidden' })
  })
})

describe('listingSearch', () => {
  it('keeps filters, terms, sort and page in a stable order, drops the rest', () => {
    const params = new URLSearchParams(
      'utm_source=x&sort_by=price-ascending&filter.p.m.custom.grip=Palm&q=mouse&filter.p.m.custom.grip=Claw&page=2&filter.v.price.gte=&fbclid=y',
    )
    expect(listingSearch(params)).toBe(
      'filter.p.m.custom.grip=Claw&filter.p.m.custom.grip=Palm&page=2&q=mouse&sort_by=price-ascending',
    )
    expect(listingSearch(new URLSearchParams('utm_source=x'))).toBe('')
  })

  it("keeps a search form's sold-out choice, not its other options", () => {
    const params = new URLSearchParams(
      'q=pad&options[prefix]=last&options[unavailable_products]=last&type=product',
    )
    expect(listingSearch(params)).toBe('options%5Bunavailable_products%5D=last&q=pad')
  })
})
