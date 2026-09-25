import { afterEach, describe, expect, it } from 'vitest'
import { devOtpHostAllowed } from './dev-otp'

afterEach(() => {
  delete process.env.DEV_OTP_ALLOWED_HOSTS
})

describe('devOtpHostAllowed', () => {
  it('allows localhost, with or without a port', () => {
    expect(devOtpHostAllowed('localhost')).toBe(true)
    expect(devOtpHostAllowed('localhost:3200')).toBe(true)
    expect(devOtpHostAllowed('127.0.0.1')).toBe(true)
    expect(devOtpHostAllowed('127.0.0.1:3200')).toBe(true)
    expect(devOtpHostAllowed('[::1]:3200')).toBe(true)
  })

  it('refuses a missing or non-local host by default', () => {
    expect(devOtpHostAllowed(null)).toBe(false)
    expect(devOtpHostAllowed('')).toBe(false)
    expect(devOtpHostAllowed('admin.example.com')).toBe(false)
    expect(devOtpHostAllowed('evil.test:3200')).toBe(false)
  })

  it('allows a host explicitly listed in DEV_OTP_ALLOWED_HOSTS', () => {
    process.env.DEV_OTP_ALLOWED_HOSTS = 'admin.dev.internal, other.dev.internal'
    expect(devOtpHostAllowed('admin.dev.internal:3200')).toBe(true)
    expect(devOtpHostAllowed('other.dev.internal')).toBe(true)
    expect(devOtpHostAllowed('unlisted.dev.internal')).toBe(false)
  })
})
