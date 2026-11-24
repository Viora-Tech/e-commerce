import { describe, expect, it } from 'vitest'
import {
  LOYALTY_REF_MAX_AGE,
  loyaltyRefCode,
  loyaltyRefCookieOptions,
  loyaltyRefLanding,
} from './loyalty-referral'

const landing = {
  param: 'abcd2345',
  existing: undefined,
  method: 'GET',
  prefetch: false,
  bot: false,
  marketing: true,
}

describe('loyalty referral cookie', () => {
  it('reads a member code, upper-cased', () => {
    expect(loyaltyRefCode(' abcd2345 ')).toBe('ABCD2345')
    expect(loyaltyRefCode('ab')).toBeNull()
    expect(loyaltyRefCode('my-affiliate')).toBeNull()
    expect(loyaltyRefCode(undefined)).toBeNull()
  })

  it('keeps the code of a real landing after a yes to marketing cookies', () => {
    expect(loyaltyRefLanding(landing)).toBe('ABCD2345')
  })

  it('leaves the cookie alone for prefetches, bots, posts, no consent or the same code', () => {
    expect(loyaltyRefLanding({ ...landing, prefetch: true })).toBeNull()
    expect(loyaltyRefLanding({ ...landing, bot: true })).toBeNull()
    expect(loyaltyRefLanding({ ...landing, method: 'POST' })).toBeNull()
    expect(loyaltyRefLanding({ ...landing, marketing: false })).toBeNull()
    expect(loyaltyRefLanding({ ...landing, existing: 'ABCD2345' })).toBeNull()
    expect(loyaltyRefLanding({ ...landing, param: null })).toBeNull()
  })

  it('lets a newer friend link replace an older one', () => {
    expect(loyaltyRefLanding({ ...landing, existing: 'ZZZZ9999' })).toBe('ABCD2345')
  })

  it('is a first-party, server-read cookie for 30 days', () => {
    expect(loyaltyRefCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: LOYALTY_REF_MAX_AGE,
    })
    expect(LOYALTY_REF_MAX_AGE).toBe(2_592_000)
  })
})
