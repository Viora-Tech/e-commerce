import { describe, expect, it } from 'vitest'
import { scrubLogEvent } from '../src/scrub-log-event'

const STORE_ID = '0193a2b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b'

describe('scrubLogEvent', () => {
  it('redacts emails, phones and tokens in any field', () => {
    const event: Record<string, unknown> = {
      message: 'invite for asha@example.com, call +91 98765 43210',
      path: '/api/m/open/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl',
    }
    scrubLogEvent(event)
    expect(event.message).not.toContain('asha@example.com')
    expect(event.message).not.toContain('98765 43210')
    expect(event.path).not.toContain('eyJhbGciOiJIUzI1NiJ9')
  })

  it('redacts sensitive keys outright, however deep', () => {
    const event: Record<string, unknown> = {
      customer: { email: 'asha@example.com', phone: '9876543210', address: '221 MG Road' },
      headers: { cookie: 'session=1', authorization: 'Basic abc' },
    }
    scrubLogEvent(event)
    expect(event.customer).toEqual({
      email: '[redacted]',
      phone: '[redacted]',
      address: '[redacted]',
    })
    expect(event.headers).toEqual({ cookie: '[redacted]', authorization: '[redacted]' })
  })

  it('keeps UUID record ids, alone or inside a string', () => {
    const event: Record<string, unknown> = {
      storeId: STORE_ID,
      job: { queue: 'notifications', orderId: STORE_ID },
      path: `/webhooks/payments/razorpay/${STORE_ID}`,
    }
    scrubLogEvent(event)
    expect(event.storeId).toBe(STORE_ID)
    expect(event.job).toEqual({ queue: 'notifications', orderId: STORE_ID })
    expect(event.path).toBe(`/webhooks/payments/razorpay/${STORE_ID}`)
  })

  it("leaves evlog's own bookkeeping fields alone", () => {
    const event: Record<string, unknown> = {
      timestamp: '2026-10-13T10:23:45.612Z',
      commitHash: 'c211bc0c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a',
      requestId: 'f3b1c2d4e5f6a7b8c9d0e1f2a3b4c5d6',
      durationMs: 1204,
    }
    const before = { ...event }
    scrubLogEvent(event)
    expect(event).toEqual(before)
  })

  it('leaves numbers, booleans and plain words alone', () => {
    const event: Record<string, unknown> = {
      outcome: 'completed',
      result: { stores: 3, cancelled: 1 },
      scheduled: true,
    }
    scrubLogEvent(event)
    expect(event).toEqual({
      outcome: 'completed',
      result: { stores: 3, cancelled: 1 },
      scheduled: true,
    })
  })
})
