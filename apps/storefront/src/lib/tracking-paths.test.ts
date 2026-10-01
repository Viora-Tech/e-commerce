import { describe, expect, it } from 'vitest'
import { trackingAllowedOn } from './tracking-paths'

describe('trackingAllowedOn', () => {
  it('keeps tags off sign-in pages that carry tokens', () => {
    expect(trackingAllowedOn('/account/login/link')).toBe(false)
    expect(trackingAllowedOn('/account/login')).toBe(false)
    expect(trackingAllowedOn('/-s/0190abcd/account/login/link')).toBe(false)
  })

  it('allows them everywhere else', () => {
    expect(trackingAllowedOn('/products/mouse')).toBe(true)
    expect(trackingAllowedOn('/account/loginx')).toBe(true)
    expect(trackingAllowedOn(null)).toBe(true)
  })
})
