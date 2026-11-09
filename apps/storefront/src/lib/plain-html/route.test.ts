import { describe, expect, it } from 'vitest'
import { PLAIN_PREFIX, routeForStore } from '../routing'
import { islandScript } from './islands'
import {
  PLAIN_OPT_OUT_COOKIE,
  type PlainRouteInput,
  plainKind,
  plainPageHandle,
  plainPath,
  plainSkipNonce,
  plainSkipToken,
  wantsPlainHtml,
} from './route'

const base: PlainRouteInput = {
  enabled: true,
  killed: false,
  method: 'GET',
  pathname: '/',
  rsc: false,
  personal: false,
  marketPrefix: '',
  cookie: () => undefined,
  handedBack: false,
}

describe('plainKind', () => {
  it('draws the home page and theme pages', () => {
    expect(plainKind('/')).toBe('home')
    expect(plainKind('/pages/about')).toBe('page')
    expect(plainKind('/pages/about/')).toBe('page')
  })

  it('leaves everything else to the React pages', () => {
    for (const path of [
      '/products/x',
      '/collections/mice',
      '/cart',
      '/checkout',
      '/account',
      '/search',
      '/pages/wishlist',
      '/pages/a/b',
      '/blogs/notes',
    ]) {
      expect(plainKind(path)).toBeNull()
    }
  })

  it('decodes the page handle, and keeps one that is not valid percent-encoding', () => {
    expect(plainPageHandle('/pages/hall%2Dof-fame')).toBe('hall-of-fame')
    expect(plainPageHandle('/pages/%E0%A4')).toBe('%E0%A4')
    expect(plainPageHandle('/')).toBeNull()
  })
})

describe('wantsPlainHtml', () => {
  it('takes a plain page view when the store switched it on', () => {
    expect(wantsPlainHtml(base)).toBe(true)
    expect(wantsPlainHtml({ ...base, method: 'HEAD', pathname: '/pages/faq' })).toBe(true)
  })

  it('is off by default, behind the kill switch, and for an opted-out browser', () => {
    expect(wantsPlainHtml({ ...base, enabled: false })).toBe(false)
    expect(wantsPlainHtml({ ...base, killed: true })).toBe(false)
    expect(
      wantsPlainHtml({ ...base, cookie: (n) => (n === PLAIN_OPT_OUT_COOKIE ? 'off' : undefined) }),
    ).toBe(false)
  })

  it('never takes a navigation payload, a personal page, a market folder or a hand-back', () => {
    expect(wantsPlainHtml({ ...base, rsc: true })).toBe(false)
    expect(wantsPlainHtml({ ...base, personal: true })).toBe(false)
    expect(wantsPlainHtml({ ...base, marketPrefix: '/ae' })).toBe(false)
    expect(wantsPlainHtml({ ...base, handedBack: true })).toBe(false)
    expect(wantsPlainHtml({ ...base, method: 'POST' })).toBe(false)
    expect(wantsPlainHtml({ ...base, pathname: '/products/x' })).toBe(false)
  })

  it('rewrites under the internal prefix, which shoppers cannot reach', () => {
    expect(plainPath('s1', '/')).toBe(`${PLAIN_PREFIX}/s1`)
    expect(plainPath('s1', '/pages/faq')).toBe(`${PLAIN_PREFIX}/s1/pages/faq`)
    expect(routeForStore('s1', `${PLAIN_PREFIX}/s2/pages/faq`)).toEqual({ kind: 'forbidden' })
  })
})

describe('the hand-back token', () => {
  const secret = 'test-secret-value'

  it('carries the nonce, signed', () => {
    const token = plainSkipToken(secret, 'abcDEF123456')
    expect(plainSkipNonce(secret, token)).toBe('abcDEF123456')
  })

  it('refuses a forged, altered or unsigned value', () => {
    const token = plainSkipToken(secret, 'abcDEF123456')
    expect(plainSkipNonce('other-secret', token)).toBeNull()
    expect(plainSkipNonce(secret, token.replace('abc', 'xyz'))).toBeNull()
    expect(plainSkipNonce(secret, 'abcDEF123456')).toBeNull()
    expect(plainSkipNonce(secret, null)).toBeNull()
    expect(plainSkipNonce('', token)).toBeNull()
  })
})

describe('islandScript', () => {
  it('is valid JavaScript with every value escaped', () => {
    const code = islandScript({
      bannerVersion: 3,
      tracking: { ga4: 'G-ABC123', gtm: 'GTM-ABC12', metaPixel: '1234567890', googleAds: '' },
      umami: { src: 'https://u.example/script.js</script>', websiteId: 'w', waitForConsent: true },
    })
    expect(code).not.toContain('</script>')
    expect(() => new Function(code)).not.toThrow()
  })
})
