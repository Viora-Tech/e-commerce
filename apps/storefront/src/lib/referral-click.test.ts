import { encodeReferral } from '@commerce/core/marketing'
import { describe, expect, it } from 'vitest'
import {
  isPrefetch,
  type ReferralClickInput,
  referralClick,
  referralCookieFromPending,
} from './referral-click'

const now = new Date('2026-10-26T10:00:00Z')
const CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

const input = (over: Partial<ReferralClickInput> = {}): ReferralClickInput => ({
  param: 'asha-k',
  existing: undefined,
  method: 'GET',
  userAgent: CHROME,
  prefetch: false,
  marketing: true,
  now,
  ...over,
})

describe('referralClick', () => {
  it('sets a cookie holding only the code and click time, and counts the click', () => {
    expect(referralClick(input())).toEqual({
      code: 'asha-k',
      cookie: `asha-k.${now.getTime() / 1000}`,
      count: true,
    })
  })

  it('lower-cases the code and ignores anything that is not one', () => {
    expect(referralClick(input({ param: 'Asha-K' }))?.code).toBe('asha-k')
    expect(referralClick(input({ param: 'no spaces' }))).toBeNull()
    expect(referralClick(input({ param: null }))).toBeNull()
  })

  it('skips bots, link previews, prefetches and non-GET requests', () => {
    expect(referralClick(input({ userAgent: 'facebookexternalhit/1.1' }))).toBeNull()
    expect(referralClick(input({ userAgent: 'WhatsApp/2.23' }))).toBeNull()
    expect(referralClick(input({ userAgent: null }))).toBeNull()
    expect(referralClick(input({ prefetch: true }))).toBeNull()
    expect(referralClick(input({ method: 'HEAD' }))).toBeNull()
  })

  it('does not count a reload of the same link inside half an hour, but refreshes the cookie', () => {
    const existing = encodeReferral({ code: 'asha-k', at: new Date(now.getTime() - 5 * 60_000) })
    expect(referralClick(input({ existing }))).toEqual({
      code: 'asha-k',
      cookie: `asha-k.${now.getTime() / 1000}`,
      count: false,
    })
  })

  it('counts the same link again after half an hour, and a different affiliate at once (last click)', () => {
    const old = encodeReferral({ code: 'asha-k', at: new Date(now.getTime() - 31 * 60_000) })
    expect(referralClick(input({ existing: old }))?.count).toBe(true)
    const other = encodeReferral({ code: 'ravi', at: new Date(now.getTime() - 60_000) })
    expect(referralClick(input({ existing: other }))).toMatchObject({ code: 'asha-k', count: true })
  })
})

describe('referral cookie and marketing consent', () => {
  it('without a yes to marketing sets no cookie, but still counts the click', () => {
    expect(referralClick(input({ marketing: false }))).toEqual({
      code: 'asha-k',
      cookie: null,
      count: true,
    })
  })

  it('a later yes sets the cookie from the landing kept in the tab, at the landing time', () => {
    const landed = new Date(now.getTime() - 3 * 60_000)
    expect(referralCookieFromPending({ code: 'Asha-K', at: landed.getTime() }, now)).toBe(
      encodeReferral({ code: 'asha-k', at: landed }),
    )
  })

  it('refuses a pending landing that is not a code, from the future or over a day old', () => {
    expect(referralCookieFromPending({ code: 'no spaces', at: now.getTime() }, now)).toBeNull()
    expect(
      referralCookieFromPending({ code: 'asha-k', at: now.getTime() + 60_000 }, now),
    ).toBeNull()
    expect(
      referralCookieFromPending({ code: 'asha-k', at: now.getTime() - 25 * 60 * 60_000 }, now),
    ).toBeNull()
    expect(referralCookieFromPending(null, now)).toBeNull()
    expect(referralCookieFromPending({ code: 'asha-k', at: 'x' }, now)).toBeNull()
  })
})

describe('isPrefetch', () => {
  it('knows the router and browser prefetch headers', () => {
    expect(isPrefetch(new Headers({ 'next-router-prefetch': '1' }))).toBe(true)
    expect(isPrefetch(new Headers({ 'sec-purpose': 'prefetch' }))).toBe(true)
    expect(isPrefetch(new Headers({ 'sec-purpose': 'prefetch;prerender' }))).toBe(false)
    expect(isPrefetch(new Headers({ purpose: 'prefetch' }))).toBe(true)
    expect(isPrefetch(new Headers({ accept: 'text/html' }))).toBe(false)
  })
})
