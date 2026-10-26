import { describe, expect, it } from 'vitest'
import { ORDER_VIEW_MAX_AGE, orderTokenSwap, pickOrderToken } from './order-token-swap'

const TOKEN =
  '0b9f3c1e-7d2a-4f6b-9a8e-1c2d3e4f5a6b.2077000000000.Ab3_x-Yz09Ab3_x-Yz09Ab3_x-Yz09Ab3_x-Yz09Ab3'

describe('orderTokenSwap', () => {
  it('moves the thank-you token out of the URL, keeping the rest of the query', () => {
    expect(orderTokenSwap('/checkout/thank-you/1042', `?t=${TOKEN}&balance=busy`)).toEqual({
      token: TOKEN,
      cookiePath: '/checkout/thank-you/1042',
      location: '/checkout/thank-you/1042?balance=busy',
    })
  })

  it('moves the pay page token too, leaving a bare path', () => {
    const swap = orderTokenSwap('/checkout/pay/7', `?t=${TOKEN}`)
    expect(swap).toEqual({
      token: TOKEN,
      cookiePath: '/checkout/pay/7',
      location: '/checkout/pay/7',
    })
  })

  it('never lets the token survive into the redirect target', () => {
    for (const search of [`?t=${TOKEN}`, `?a=1&t=${TOKEN}`, `?t=${TOKEN}&t=other`, `?t=`]) {
      const swap = orderTokenSwap('/checkout/thank-you/9', search)
      expect(swap).not.toBeNull()
      expect(new URL(swap?.location ?? '', 'https://shop.test').searchParams.has('t')).toBe(false)
      expect(swap?.location).not.toContain(TOKEN)
    }
  })

  it('drops a malformed token without keeping it in a cookie', () => {
    expect(orderTokenSwap('/checkout/thank-you/9', '?t=<script>')).toEqual({
      token: null,
      cookiePath: '/checkout/thank-you/9',
      location: '/checkout/thank-you/9',
    })
  })

  it('leaves every other page and token-free URLs alone', () => {
    expect(orderTokenSwap('/checkout/thank-you/9', '')).toBeNull()
    expect(orderTokenSwap('/checkout/thank-you/9', '?balance=busy')).toBeNull()
    expect(orderTokenSwap('/checkout/balance/abc', `?t=${TOKEN}`)).toBeNull()
    expect(orderTokenSwap('/reviews/unsubscribe', `?t=${TOKEN}`)).toBeNull()
    expect(orderTokenSwap('/checkout/thank-you/9/extra', `?t=${TOKEN}`)).toBeNull()
  })

  it('scopes the cookie to the page without a trailing slash', () => {
    expect(orderTokenSwap('/checkout/thank-you/9/', `?t=${TOKEN}`)?.cookiePath).toBe(
      '/checkout/thank-you/9',
    )
  })

  it('keeps the cookie short-lived', () => {
    expect(ORDER_VIEW_MAX_AGE).toBeLessThanOrEqual(30 * 60)
  })
})

describe('pickOrderToken', () => {
  it('reads the cookie when the URL has no token (after the swap)', () => {
    expect(pickOrderToken(undefined, TOKEN)).toBe(TOKEN)
  })

  it('prefers a token still in the URL', () => {
    expect(pickOrderToken('from-url', TOKEN)).toBe('from-url')
    expect(pickOrderToken(['first', 'second'], TOKEN)).toBe('first')
  })

  it('is undefined with neither', () => {
    expect(pickOrderToken(undefined, undefined)).toBeUndefined()
    expect(pickOrderToken('', '')).toBeUndefined()
  })
})
