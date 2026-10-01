import { describe, expect, it } from 'vitest'
import { scrubPii } from '../src/scrub-pii'

describe('scrubPii', () => {
  it('redacts an email address inside a message string', () => {
    const event = { message: 'Order failed for asha@example.com during checkout' }
    const out = scrubPii(event)
    expect(out.message).not.toContain('asha@example.com')
    expect(out.message).toContain('[redacted]')
  })

  it('redacts a phone number inside a message string', () => {
    const event = { message: 'Call the customer at +91 98765 43210 about the refund' }
    const out = scrubPii(event)
    expect(out.message).not.toContain('98765 43210')
    expect(out.message).toContain('[redacted]')
  })

  it('redacts known-sensitive keys outright, regardless of shape', () => {
    const event = {
      user: { id: 'usr_1', email: 'asha@example.com', ip_address: '203.0.113.5' },
      extra: { address: '221 MG Road, Bengaluru', token: 'abc123' },
    }
    const out = scrubPii(event)
    expect(out.user.id).toBe('usr_1')
    expect(out.user.email).toBe('[redacted]')
    expect(out.user.ip_address).toBe('[redacted]')
    expect(out.extra.address).toBe('[redacted]')
    expect(out.extra.token).toBe('[redacted]')
  })

  it('redacts bearer-token-shaped strings and long opaque secrets', () => {
    const event = {
      breadcrumbs: [
        { message: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc' },
        { message: 'apiKey=sk_live_1234567890abcdef1234567890' },
      ],
    }
    const out = scrubPii(event)
    expect(out.breadcrumbs[0].message).not.toContain('eyJhbGciOiJIUzI1NiJ9')
    expect(out.breadcrumbs[1].message).not.toContain('sk_live_1234567890abcdef1234567890')
  })

  it('scrubs nested arrays and leaves non-PII data alone', () => {
    const event = {
      tags: { storeId: 'store_1', route: '/orders/42' },
      extra: { items: [{ title: 'Mousepad', qty: 1 }] },
    }
    const out = scrubPii(event)
    expect(out.tags.storeId).toBe('store_1')
    expect(out.tags.route).toBe('/orders/42')
    expect(out.extra.items[0]).toEqual({ title: 'Mousepad', qty: 1 })
  })

  it('does not mutate the input event', () => {
    const event = { user: { email: 'asha@example.com' } }
    scrubPii(event)
    expect(event.user.email).toBe('asha@example.com')
  })

  it('redacts credential keys however they are spelled', () => {
    const out = scrubPii({
      extra: {
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        clientSecret: 'GOCSPX-abc/def',
        accessToken: 'shpat_12345',
        privateKey: '-----BEGIN PRIVATE KEY-----',
        otp: '123456',
        orderId: 'o_1',
      },
      request: { headers: { 'X-Api-Key': 'k', 'x-client-secret': 's', Cookie: 'wc_customer=1' } },
    })
    expect(out.extra).toEqual({
      secretAccessKey: '[redacted]',
      clientSecret: '[redacted]',
      accessToken: '[redacted]',
      privateKey: '[redacted]',
      otp: '[redacted]',
      orderId: 'o_1',
    })
    expect(out.request.headers).toEqual({
      'X-Api-Key': '[redacted]',
      'x-client-secret': '[redacted]',
      Cookie: '[redacted]',
    })
  })

  it('redacts a UPI id inside a message', () => {
    expect(scrubPii({ message: 'Paid from asha.rao@okaxis today' }).message).not.toContain('okaxis')
  })
})
