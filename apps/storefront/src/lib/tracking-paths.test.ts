import { describe, expect, it } from 'vitest'
import { trackingAllowedOn } from './tracking-paths'

describe('trackingAllowedOn', () => {
  it('keeps tags off sign-in pages that carry tokens', () => {
    expect(trackingAllowedOn('/account/login/link')).toBe(false)
    expect(trackingAllowedOn('/account/login')).toBe(false)
    expect(trackingAllowedOn('/-s/0190abcd/account/login/link')).toBe(false)
  })

  it('keeps tags off pages whose path is a token', () => {
    for (const path of [
      '/checkout/balance/tok',
      '/checkout/invoice/tok',
      '/checkout/recover/tok',
      '/cod/tok',
      '/newsletter/confirm/tok',
      '/unsubscribe/tok',
      '/-s/0190abcd/cod/tok',
    ]) {
      expect(trackingAllowedOn(path)).toBe(false)
    }
    expect(trackingAllowedOn('/checkout/thank-you/1042')).toBe(true)
    expect(trackingAllowedOn('/collections/codes')).toBe(true)
  })

  it('allows them everywhere else', () => {
    expect(trackingAllowedOn('/products/mouse')).toBe(true)
    expect(trackingAllowedOn('/account/loginx')).toBe(true)
    expect(trackingAllowedOn(null)).toBe(true)
  })
})
