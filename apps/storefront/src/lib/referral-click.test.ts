import { encodeReferral } from '@commerce/core/marketing'
import { describe, expect, it } from 'vitest'
import { isPrefetch, type ReferralClickInput, referralClick } from './referral-click'

const now = new Date('2026-10-26T10:00:00Z')
const CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

const input = (over: Partial<ReferralClickInput> = {}): ReferralClickInput => ({
  param: 'asha-k',
  existing: undefined,
  method: 'GET',
  userAgent: CHROME,
  prefetch: false,
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

describe('isPrefetch', () => {
  it('knows the router and browser prefetch headers', () => {
    expect(isPrefetch(new Headers({ 'next-router-prefetch': '1' }))).toBe(true)
    expect(isPrefetch(new Headers({ 'sec-purpose': 'prefetch' }))).toBe(true)
    expect(isPrefetch(new Headers({ 'sec-purpose': 'prefetch;prerender' }))).toBe(false)
    expect(isPrefetch(new Headers({ purpose: 'prefetch' }))).toBe(true)
    expect(isPrefetch(new Headers({ accept: 'text/html' }))).toBe(false)
  })
})
