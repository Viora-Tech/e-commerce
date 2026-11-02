import { describe, expect, it } from 'vitest'
import { scrubAudit } from '../src/scrub-audit'

describe('scrubAudit', () => {
  it('redacts credentials, payment details and contact details by key', () => {
    expect(
      scrubAudit({
        keyId: 'rzp_live_x',
        keySecret: 'abc',
        accessToken: 'abc',
        password: 'abc',
        otp: '123456',
        upiId: 'ravi@okaxis',
        bankAccount: '1234567890',
        email: 'a@b.co',
        phone: '9876543210',
        address: { line1: 'x' },
        empty: '',
      }),
    ).toEqual({
      keyId: '[redacted]',
      keySecret: '[redacted]',
      accessToken: '[redacted]',
      password: '[redacted]',
      otp: '[redacted]',
      upiId: '[redacted]',
      bankAccount: '[redacted]',
      email: '[redacted]',
      phone: '[redacted]',
      address: '[redacted]',
      empty: '',
    })
  })

  it('redacts secrets and emails inside free text, and keeps handles, dates and ids', () => {
    const out = scrubAudit({
      note: 'key rzp_test_ABCDEF12345 for ravi@example.com',
      handle: 'mens-cotton-shirt-blue-large-xl',
      startsAt: '2026-10-30T10:00:00.000Z',
      id: '0190f7a0-0000-7000-8000-000000000000',
      price: 49900,
    })
    expect(out).toEqual({
      note: 'key [redacted] for [redacted]',
      handle: 'mens-cotton-shirt-blue-large-xl',
      startsAt: '2026-10-30T10:00:00.000Z',
      id: '0190f7a0-0000-7000-8000-000000000000',
      price: 49900,
    })
  })

  it('clips long strings and lists', () => {
    const out = scrubAudit({
      text: 'a '.repeat(400),
      list: Array.from({ length: 60 }, (_, i) => i),
    })
    const { text, list } = out as { text: string; list: unknown[] }
    expect(text.length).toBeLessThanOrEqual(500)
    expect(list).toHaveLength(51)
    expect(list.at(-1)).toBe('… 10 more')
  })
})
