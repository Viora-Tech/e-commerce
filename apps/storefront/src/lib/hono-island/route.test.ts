import { readHonoPreviewToken, signHonoPreviewToken } from '@commerce/core/hono-preview'
import { describe, expect, it } from 'vitest'
import { HONO_PREFIX, routeForStore } from '../routing'
import {
  BREAKER_FAILURES,
  BREAKER_REST_MS,
  type Breaker,
  HONO_COOKIE,
  HONO_RENDER,
  type HonoRouteInput,
  honoBreaker,
  honoForwardNonce,
  honoForwardToken,
  honoIslandFile,
  honoPath,
  honoPreviewLink,
  honoProductHandle,
  honoVerdict,
  sameOrigin,
  wantsHono,
} from './route'

const base: HonoRouteInput = {
  enabled: true,
  serviceUrl: 'http://storefront-hono:3200',
  method: 'GET',
  pathname: '/products/blue-tee',
  searchParams: new URLSearchParams(),
  rsc: false,
  personal: false,
  marketPrefix: '',
  cookie: () => undefined,
  handedBack: false,
  resting: false,
}

describe('wantsHono (the store switch and the path)', () => {
  it('sends a product page of a switched-on store to the service', () => {
    expect(wantsHono(base)).toBe(true)
    expect(wantsHono({ ...base, method: 'HEAD' })).toBe(true)
    expect(wantsHono({ ...base, pathname: '/products/blue-tee/' })).toBe(true)
    // Tracking params never keep a page on Next.
    expect(wantsHono({ ...base, searchParams: new URLSearchParams('utm_source=ig') })).toBe(true)
  })

  it('keeps every store on Next while its switch is off (the default)', () => {
    expect(wantsHono({ ...base, enabled: false })).toBe(false)
  })

  it('keeps every store on Next while STOREFRONT_HONO_URL is unset', () => {
    expect(wantsHono({ ...base, serviceUrl: null })).toBe(false)
    expect(wantsHono({ ...base, serviceUrl: '' })).toBe(false)
  })

  it('draws only /products/<handle>', () => {
    for (const pathname of [
      '/',
      '/products',
      '/products/',
      '/products/a/b',
      '/collections/tees',
      '/collections/tees/products/blue-tee',
      '/cart',
      '/pages/about',
    ]) {
      expect(wantsHono({ ...base, pathname }), pathname).toBe(false)
    }
  })

  it('leaves to Next what only Next answers', () => {
    expect(wantsHono({ ...base, method: 'POST' })).toBe(false)
    expect(wantsHono({ ...base, rsc: true })).toBe(false)
    expect(wantsHono({ ...base, personal: true })).toBe(false)
    expect(wantsHono({ ...base, marketPrefix: '/ae' })).toBe(false)
    expect(wantsHono({ ...base, handedBack: true })).toBe(false)
    expect(wantsHono({ ...base, resting: true })).toBe(false)
    for (const q of ['view=alt', 'review=tok', 'write=1']) {
      expect(wantsHono({ ...base, searchParams: new URLSearchParams(q) }), q).toBe(false)
    }
  })

  it('lets one browser opt out', () => {
    const cookie = (name: string) => (name === HONO_COOKIE ? 'off' : undefined)
    expect(wantsHono({ ...base, cookie })).toBe(false)
  })

  it("previews in the owner's browser while the store's switch is off (wc_hono=on)", () => {
    const on = (name: string) => (name === HONO_COOKIE ? 'on' : undefined)
    expect(wantsHono({ ...base, enabled: false, cookie: on })).toBe(true)
    // Still only where the service is configured, only product pages, and never past the rules.
    expect(wantsHono({ ...base, enabled: false, cookie: on, serviceUrl: null })).toBe(false)
    expect(wantsHono({ ...base, enabled: false, cookie: on, pathname: '/cart' })).toBe(false)
    expect(wantsHono({ ...base, enabled: false, cookie: on, resting: true })).toBe(false)
    expect(wantsHono({ ...base, enabled: false, cookie: on, handedBack: true })).toBe(false)
    // Any other value is nothing.
    const odd = (name: string) => (name === HONO_COOKIE ? 'yes' : undefined)
    expect(wantsHono({ ...base, enabled: false, cookie: odd })).toBe(false)
  })
})

describe('honoPreviewLink (?hono=)', () => {
  const secret = 'settings-secret'
  const storeId = 'store-1'
  const verify = (token: string) => readHonoPreviewToken({ secret, storeId, token })
  const at = (q: string) => new URL(`https://www.waimers.in/products/blue-tee?utm_source=ig&${q}`)

  it('does nothing without the param', () => {
    expect(honoPreviewLink(new URL('https://www.waimers.in/products/x'), verify)).toBeNull()
  })

  it('turns the preview on only for a live token the admin signed for this store', () => {
    const token = signHonoPreviewToken({ secret, storeId })
    expect(honoPreviewLink(at(`hono=${encodeURIComponent(token)}`), verify)).toEqual({
      cookie: 'on',
      location: '/products/blue-tee?utm_source=ig',
    })
  })

  it('turns nothing on for anyone else: unsigned, another store, forged or expired', () => {
    const other = signHonoPreviewToken({ secret, storeId: 'store-2' })
    const old = signHonoPreviewToken({ secret, storeId, now: Date.now() - 2 * 60 * 60 * 1000 })
    const forged = `${Math.floor(Date.now() / 1000) + 600}.forged`
    for (const value of ['on', 'true', '1', other, old, forged, '']) {
      expect(honoPreviewLink(at(`hono=${encodeURIComponent(value)}`), verify)?.cookie, value).toBe(
        'keep',
      )
    }
  })

  it('opts this browser out, or back to following the store', () => {
    expect(honoPreviewLink(at('hono=off'), verify)).toEqual({
      cookie: 'off',
      location: '/products/blue-tee?utm_source=ig',
    })
    expect(honoPreviewLink(new URL('https://x.in/?hono=clear'), verify)).toEqual({
      cookie: 'clear',
      location: '/',
    })
  })
})

describe('paths', () => {
  it('decodes the handle and refuses a broken one', () => {
    expect(honoProductHandle('/products/caf%C3%A9')).toBe('café')
    expect(honoProductHandle('/products/%E0%A4')).toBeNull()
    expect(honoProductHandle('/collections/x')).toBeNull()
  })

  it('rewrites under the internal prefix, which a shopper cannot reach', () => {
    expect(honoPath('s1', '/products/x')).toBe(`${HONO_PREFIX}/s1/products/x`)
    expect(routeForStore('s1', `${HONO_PREFIX}/s1/products/x`)).toEqual({ kind: 'forbidden' })
  })

  it('serves only built island file names', () => {
    expect(honoIslandFile('client-00zwsxnq.js')).toBe('client-00zwsxnq.js')
    expect(honoIslandFile('chunk-abc.js')).toBe('chunk-abc.js')
    for (const bad of ['../x.js', 'x.json', 'a/b.js', '.js', 'x.js?y', '%2e%2e.js']) {
      expect(honoIslandFile(bad), bad).toBeNull()
    }
  })
})

describe('forward signature', () => {
  const f = { storeId: 'store-1', host: 'www.waimers.in', nonce: 'abcDEF123456' }

  it('carries the outer nonce for the store and host it was signed for', () => {
    const token = honoForwardToken('secret', f)
    expect(honoForwardNonce('secret', f, token)).toBe(f.nonce)
  })

  it('refuses another store, another host, another secret or a forged value', () => {
    const token = honoForwardToken('secret', f)
    expect(honoForwardNonce('secret', { ...f, storeId: 'store-2' }, token)).toBeNull()
    expect(honoForwardNonce('secret', { ...f, host: 'evil.example' }, token)).toBeNull()
    expect(honoForwardNonce('other', f, token)).toBeNull()
    expect(honoForwardNonce('secret', f, `${f.nonce}.forged`)).toBeNull()
    expect(honoForwardNonce('secret', f, null)).toBeNull()
    expect(honoForwardNonce('', f, token)).toBeNull()
    expect(honoForwardNonce('secret', { storeId: null, host: f.host }, token)).toBeNull()
    expect(honoForwardNonce('secret', f, 'no-dot')).toBeNull()
  })
})

describe('honoVerdict (the fallback decision)', () => {
  const page = {
    status: 200,
    render: HONO_RENDER,
    contentType: 'text/html; charset=utf-8',
    skip: null,
  }

  it('uses a whole page the service drew', () => {
    expect(honoVerdict(page)).toEqual({ use: true })
  })

  it('falls back on an error or a timeout, counting a failure', () => {
    expect(honoVerdict({ error: 'timeout' })).toEqual({
      use: false,
      reason: 'timeout',
      failure: true,
    })
    expect(honoVerdict({ error: 'unreachable' })).toMatchObject({ use: false, failure: true })
  })

  it('falls back on any other status, a page that is not the service', () => {
    for (const status of [500, 502, 503, 403, 301]) {
      expect(honoVerdict({ ...page, status })).toEqual({
        use: false,
        reason: `status-${status}`,
        failure: true,
      })
    }
    expect(honoVerdict({ ...page, render: null })).toMatchObject({ use: false, reason: 'not-hono' })
    expect(honoVerdict({ ...page, contentType: 'text/plain' })).toMatchObject({
      use: false,
      reason: 'not-html',
    })
  })

  it('falls back without a failure for a page the service does not draw, or a 404', () => {
    expect(honoVerdict({ ...page, status: 501, skip: 'app-block' })).toEqual({
      use: false,
      reason: 'skip:app-block',
      failure: false,
    })
    expect(honoVerdict({ ...page, status: 404 })).toEqual({
      use: false,
      reason: 'not-found',
      failure: false,
    })
  })
})

describe('honoBreaker', () => {
  const fail = { use: false as const, reason: 'timeout', failure: true }

  it('rests the service after failures in a row, then tries again', () => {
    const state: Breaker = { failures: 0, restUntil: 0 }
    for (let i = 0; i < BREAKER_FAILURES - 1; i++) honoBreaker(state, 1000).note(fail)
    expect(honoBreaker(state, 1000).resting()).toBe(false)
    honoBreaker(state, 1000).note(fail)
    expect(honoBreaker(state, 1001).resting()).toBe(true)
    expect(honoBreaker(state, 1000 + BREAKER_REST_MS).resting()).toBe(false)
  })

  it('a good answer or a skip resets or keeps the count', () => {
    const state: Breaker = { failures: 0, restUntil: 0 }
    for (let i = 0; i < BREAKER_FAILURES - 1; i++) honoBreaker(state, 0).note(fail)
    honoBreaker(state, 0).note({ use: false, reason: 'skip:x', failure: false })
    expect(state.failures).toBe(BREAKER_FAILURES - 1)
    honoBreaker(state, 0).note({ use: true })
    expect(state).toEqual({ failures: 0, restUntil: 0 })
  })
})

describe('sameOrigin (island actions)', () => {
  const req = (h: Record<string, string>) =>
    new Request('http://x/theme-actions/island-add', { method: 'POST', headers: h })

  it('takes JSON from this host', () => {
    const json = { 'content-type': 'application/json', host: 'www.waimers.in' }
    expect(sameOrigin(req(json))).toBe(true)
    expect(sameOrigin(req({ ...json, origin: 'https://www.waimers.in' }))).toBe(true)
  })

  it('refuses another origin or a form post', () => {
    expect(
      sameOrigin(
        req({
          'content-type': 'application/json',
          host: 'www.waimers.in',
          origin: 'https://evil.example',
        }),
      ),
    ).toBe(false)
    expect(
      sameOrigin(req({ 'content-type': 'application/x-www-form-urlencoded', host: 'a' })),
    ).toBe(false)
    expect(
      sameOrigin(req({ 'content-type': 'application/json', host: 'a', origin: 'not a url' })),
    ).toBe(false)
  })
})
