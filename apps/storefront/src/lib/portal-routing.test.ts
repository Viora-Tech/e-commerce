import { describe, expect, it } from 'vitest'
import {
  portalHostBase,
  portalHostFor,
  portalOriginFor,
  portalPathRest,
  portalRedirect,
  portalStoreHosts,
  routeForPortalHost,
} from './portal-routing'
import { routeForStore } from './routing'

const STORE = '00000000-0000-4000-8000-000000000001'

describe('portal host names', () => {
  it('reads the store domain under affiliate.', () => {
    expect(portalHostBase('affiliate.waimers.in')).toBe('waimers.in')
    expect(portalHostBase('affiliate.shop.waimers.store')).toBe('shop.waimers.store')
    expect(portalHostBase('www.waimers.in')).toBeNull()
    expect(portalHostBase('affiliates.waimers.in')).toBeNull()
    // A bare `affiliate.localhost` is a name of its own, not a portal over `localhost`.
    expect(portalHostBase('affiliate.localhost')).toBeNull()
    expect(portalHostBase(null)).toBeNull()
  })

  it('looks the store up by the domain and its www twin', () => {
    expect(portalStoreHosts('waimers.in')).toEqual(['waimers.in', 'www.waimers.in'])
    expect(portalStoreHosts('www.waimers.in')).toEqual(['www.waimers.in', 'waimers.in'])
  })

  it('names the portal host and origin for a store domain', () => {
    expect(portalHostFor('www.waimers.in')).toBe('affiliate.waimers.in')
    expect(portalHostFor('waimers.in')).toBe('affiliate.waimers.in')
    expect(portalOriginFor('https://www.waimers.in')).toBe('https://affiliate.waimers.in')
    expect(portalOriginFor('http://waimers.localhost:3100')).toBe(
      'http://affiliate.waimers.localhost:3100',
    )
  })
})

describe('portal paths', () => {
  it('takes /affiliate and below, nothing that only starts with it', () => {
    expect(portalPathRest('/affiliate')).toBe('')
    expect(portalPathRest('/affiliate/payouts')).toBe('/payouts')
    expect(portalPathRest('/affiliates')).toBeNull()
    expect(portalPathRest('/pages/affiliate')).toBeNull()
  })

  it('routes the store domain /affiliate into the portal segment, not the theme', () => {
    expect(routeForStore(STORE, '/affiliate')).toEqual({ kind: 'rewrite', path: `/-f/${STORE}` })
    expect(routeForStore(STORE, '/affiliate/settings/payout')).toEqual({
      kind: 'rewrite',
      path: `/-f/${STORE}/settings/payout`,
    })
    expect(routeForStore(STORE, `/-f/${STORE}`)).toEqual({ kind: 'forbidden' })
  })

  it('routes the portal host', () => {
    expect(routeForPortalHost(STORE, '/')).toEqual({ kind: 'rewrite', path: `/-f/${STORE}` })
    expect(routeForPortalHost(STORE, '/guide')).toEqual({
      kind: 'rewrite',
      path: `/-f/${STORE}/guide`,
    })
    expect(routeForPortalHost(STORE, '/_next/static/x.js')).toEqual({ kind: 'passthrough' })
    expect(routeForPortalHost(STORE, '/api/search/suggest')).toEqual({ kind: 'passthrough' })
    expect(routeForPortalHost(STORE, '/-s/x')).toEqual({ kind: 'forbidden' })
    expect(routeForPortalHost(STORE, '/continue')).toEqual({ kind: 'forbidden' })
  })
})

describe('portalRedirect', () => {
  const base = {
    hostname: 'www.waimers.in',
    port: '',
    pathname: '/affiliate/payouts',
    search: '?x=1',
    protocol: 'https:',
    method: 'GET',
    portalLive: true,
    dev: false,
  }

  it('moves page loads to the live portal host', () => {
    expect(portalRedirect(base)).toBe('https://affiliate.waimers.in/payouts?x=1')
    expect(portalRedirect({ ...base, pathname: '/affiliate', search: '' })).toBe(
      'https://affiliate.waimers.in/',
    )
  })

  it('serves here while the host is not live, for posts, and for the hand-off', () => {
    expect(portalRedirect({ ...base, portalLive: false })).toBeNull()
    expect(portalRedirect({ ...base, method: 'POST' })).toBeNull()
    expect(portalRedirect({ ...base, pathname: '/affiliate/continue' })).toBeNull()
    expect(portalRedirect({ ...base, pathname: '/products/mat' })).toBeNull()
  })

  it('keeps the scheme and port in development', () => {
    expect(
      portalRedirect({
        ...base,
        hostname: 'waimers.localhost',
        port: '3100',
        protocol: 'http:',
        dev: true,
      }),
    ).toBe('http://affiliate.waimers.localhost:3100/payouts?x=1')
  })
})
