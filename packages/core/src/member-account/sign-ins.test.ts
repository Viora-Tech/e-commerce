/** SOURCE OF TRUTH: member sign-in log tests — WHAT: IP masking and the sign-in method / WHY: the log must never keep a full IP */
import { describe, expect, it } from 'vitest'
import { maskIp, signInMethod } from './sign-ins'

describe('maskIp', () => {
  it('hides the last part of an address', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.x')
    expect(maskIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3::x')
    expect(maskIp('')).toBeNull()
    expect(maskIp(null)).toBeNull()
    expect(maskIp('not-an-ip')).toBeNull()
  })
})

describe('signInMethod', () => {
  it('reads the endpoint that opened the session', () => {
    expect(signInMethod('/sign-in/email-otp')).toBe('email_otp')
    expect(signInMethod('/passkey/verify-authentication')).toBe('passkey')
    expect(signInMethod('/organization/accept-invitation')).toBe('other')
    expect(signInMethod(undefined)).toBe('other')
  })
})
