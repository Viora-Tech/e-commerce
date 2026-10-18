import { describe, expect, it, vi } from 'vitest'
import { OTP_RETURN_TO, type OtpActions, requestOtp, verifyOtp } from './checkout-otp'

const actions = (): OtpActions => ({
  requestPhone: vi.fn(async () => ({ ok: true, mobile: '9876543210' })),
  requestEmail: vi.fn(async () => ({ ok: true, email: 'asha@example.com' })),
  verifyPhone: vi.fn(async () => undefined),
  verifyEmail: vi.fn(async () => ({ error: 'That code is not right.' })),
})

const phone = { channel: 'phone', phone: '+919876543210', email: '', method: 'whatsapp' } as const

describe('requestOtp', () => {
  it('asks the store action for a phone code by the chosen method', async () => {
    const a = actions()
    expect(await requestOtp(phone, a)).toEqual({ ok: true, sentTo: '9876543210' })
    expect(a.requestPhone).toHaveBeenCalledWith('+919876543210', 'whatsapp')
    expect(a.requestEmail).not.toHaveBeenCalled()
  })

  it('never calls the server for a number that is not a mobile', async () => {
    const a = actions()
    const r = await requestOtp({ ...phone, phone: '12345' }, a)
    expect(r).toMatchObject({ ok: false, field: 'phone' })
    expect(a.requestPhone).not.toHaveBeenCalled()
  })

  it('passes the action refusal through unchanged (rate limits, resend lockout)', async () => {
    const a = actions()
    a.requestPhone = vi.fn(async () => ({ ok: false, error: 'Too many attempts.' }))
    expect(await requestOtp(phone, a)).toEqual({ ok: false, error: 'Too many attempts.' })
  })

  it('sends an email code on the email channel', async () => {
    const a = actions()
    const r = await requestOtp({ ...phone, channel: 'email', email: 'asha@example.com' }, a)
    expect(r).toEqual({ ok: true, sentTo: 'asha@example.com' })
    expect(a.requestEmail).toHaveBeenCalledWith('asha@example.com')
  })
})

describe('verifyOtp', () => {
  it('verifies with the store action and comes back to the checkout', async () => {
    const a = actions()
    expect(await verifyOtp({ channel: 'phone', sentTo: '9876543210', code: '123456' }, a)).toBe(
      null,
    )
    expect(a.verifyPhone).toHaveBeenCalledWith('9876543210', '123456', OTP_RETURN_TO)
    expect(OTP_RETURN_TO).toBe('/checkout')
  })

  it('returns the action error, and checks the code shape first', async () => {
    const a = actions()
    expect(
      await verifyOtp({ channel: 'email', sentTo: 'asha@example.com', code: '123456' }, a),
    ).toBe('That code is not right.')
    expect(await verifyOtp({ channel: 'phone', sentTo: '9876543210', code: '12' }, a)).toBeTruthy()
    expect(a.verifyPhone).not.toHaveBeenCalled()
  })
})
