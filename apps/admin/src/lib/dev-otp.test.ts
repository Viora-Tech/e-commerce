import { afterEach, describe, expect, it, vi } from 'vitest'
import { devOtpEnabled, devOtpHostAllowed, recallDevOtp, rememberDevOtp } from './dev-otp'

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

describe('dev login code readback in production', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is off in production even with every flag set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEV_LOGIN_OTP', '1')
    vi.stubEnv('DEV_OTP_ALLOWED_HOSTS', 'admin.example.com')
    expect(devOtpEnabled()).toBe(false)
    rememberDevOtp('a@b.in', '123456')
    expect(recallDevOtp('a@b.in')).toBeNull()
    const { GET } = await import('@/app/api/dev/otp/route')
    const res = await GET(
      new Request('http://localhost:3200/api/dev/otp?email=a@b.in', {
        headers: { host: 'localhost:3200' },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('works only in development with the flag', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_LOGIN_OTP', '1')
    expect(devOtpEnabled()).toBe(true)
    rememberDevOtp('a@b.in', '654321')
    const { GET } = await import('@/app/api/dev/otp/route')
    const res = await GET(
      new Request('http://localhost:3200/api/dev/otp?email=a@b.in', {
        headers: { host: 'localhost:3200' },
      }),
    )
    expect(await res.json()).toEqual({ otp: '654321' })
  })
})
