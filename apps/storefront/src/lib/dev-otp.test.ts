import { afterEach, describe, expect, it, vi } from 'vitest'
import { devOtpEnabled, devOtpHostAllowed, recallDevOtp, rememberDevOtp } from './dev-otp'

afterEach(() => {
  delete process.env.DEV_OTP_ALLOWED_HOSTS
})

describe('devOtpHostAllowed', () => {
  it('allows localhost, with or without a port', () => {
    expect(devOtpHostAllowed('localhost')).toBe(true)
    expect(devOtpHostAllowed('localhost:3100')).toBe(true)
    expect(devOtpHostAllowed('127.0.0.1')).toBe(true)
    expect(devOtpHostAllowed('127.0.0.1:3100')).toBe(true)
    expect(devOtpHostAllowed('[::1]:3100')).toBe(true)
  })

  it('refuses a missing or non-local host by default', () => {
    expect(devOtpHostAllowed(null)).toBe(false)
    expect(devOtpHostAllowed('')).toBe(false)
    expect(devOtpHostAllowed('shop.example.com')).toBe(false)
    expect(devOtpHostAllowed('evil.test:3100')).toBe(false)
  })

  it('allows a host explicitly listed in DEV_OTP_ALLOWED_HOSTS', () => {
    process.env.DEV_OTP_ALLOWED_HOSTS = 'shop.dev.internal'
    expect(devOtpHostAllowed('shop.dev.internal:3100')).toBe(true)
    expect(devOtpHostAllowed('unlisted.dev.internal')).toBe(false)
  })
})

describe('dev sign-in code readback in production', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const ask = (host: string) =>
    new Request(`http://${host}/api/dev/otp?email=a@b.in`, {
      headers: { host, 'x-store-id': 'store-a' },
    })

  it('is off in production even with every flag set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEV_LOGIN_OTP', '1')
    vi.stubEnv('DEV_OTP_ALLOWED_HOSTS', 'shop.example.com')
    expect(devOtpEnabled()).toBe(false)
    rememberDevOtp('store-a', 'a@b.in', '123456')
    expect(recallDevOtp('store-a', 'a@b.in')).toBeNull()
    const { GET } = await import('@/app/api/dev/otp/route')
    expect((await GET(ask('localhost:3100'))).status).toBe(404)
    expect((await GET(ask('shop.example.com'))).status).toBe(404)
  })

  it('works only in development with the flag', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEV_LOGIN_OTP', '1')
    rememberDevOtp('store-a', 'a@b.in', '654321')
    const { GET } = await import('@/app/api/dev/otp/route')
    expect(await (await GET(ask('localhost:3100'))).json()).toEqual({ otp: '654321' })
  })
})
