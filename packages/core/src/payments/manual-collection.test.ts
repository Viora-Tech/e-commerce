/** SOURCE OF TRUTH: manual payment details — tests reading, writing and grouping the recorded method */
import { describe, expect, it } from 'vitest'
import {
  isIsoDay,
  paymentMethodKey,
  readManualCollection,
  withManualCollection,
} from './manual-collection'

describe('manual collection', () => {
  it('adds the collection beside whatever the gateway stored', () => {
    const session = { kind: 'manual', provider: 'manual', providerRef: 'r1', instructions: {} }
    const next = withManualCollection(session, {
      method: 'upi',
      reference: '  UTR123456  ',
      receivedOn: '2026-09-27',
      recordedBy: 'owner@example.com',
      recordedAt: '2026-09-28T06:00:00.000Z',
    })
    const collected = {
      method: 'upi',
      reference: 'UTR123456',
      receivedOn: '2026-09-27',
      recordedBy: 'owner@example.com',
      recordedAt: '2026-09-28T06:00:00.000Z',
    }
    expect(next).toEqual({ ...session, collected })
    expect(readManualCollection(next)).toEqual(collected)
  })

  it('starts from nothing when the row had no session, and drops blank or bad fields', () => {
    expect(
      withManualCollection(null, { method: 'cash', reference: '   ', receivedOn: '2026-02-30' }),
    ).toEqual({ collected: { method: 'cash' } })
  })

  it('reads nothing from gateway sessions, junk or unknown methods', () => {
    expect(readManualCollection(null)).toBeNull()
    expect(readManualCollection('x')).toBeNull()
    expect(readManualCollection({ kind: 'client' })).toBeNull()
    expect(readManualCollection({ collected: { method: 'barter' } })).toBeNull()
    expect(readManualCollection({ collected: { method: 'cheque', receivedOn: 'soon' } })).toEqual({
      method: 'cheque',
      reference: undefined,
      receivedOn: undefined,
      recordedBy: undefined,
      recordedAt: undefined,
    })
  })

  it('groups by the recorded method, else the provider', () => {
    expect(
      paymentMethodKey({ provider: 'cod', checkoutSession: { collected: { method: 'cash' } } }),
    ).toBe('cash')
    expect(paymentMethodKey({ provider: 'razorpay', checkoutSession: { kind: 'client' } })).toBe(
      'razorpay',
    )
  })

  it('accepts only real days', () => {
    expect(isIsoDay('2026-09-28')).toBe(true)
    expect(isIsoDay('2026-13-01')).toBe(false)
    expect(isIsoDay('28-09-2026')).toBe(false)
  })
})
