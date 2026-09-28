import { describe, expect, it } from 'vitest'
import {
  ACCOUNTS_PREFIX,
  INTERNAL_PREFIX,
  PASSWORD_PREFIX,
  primaryRedirect,
  routeForAccounts,
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
