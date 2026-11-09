import { DuplicateCheckout, TooManyUnpaidCheckouts, UnpaidTransferExists } from '@commerce/core'
import { describe, expect, it, vi } from 'vitest'
import { repeatCheckoutResult } from './checkout-repeat'

vi.mock('@commerce/config', () => ({ settingsSecret: () => 'test-secret-test-secret-1234' }))

const now = new Date('2026-11-08T12:00:00Z')
const earlier = {
  id: 'o1',
  number: 1042,
  draftNumber: null,
  customerId: 'c1',
  email: 'asha@example.com',
  phone: '9876543210',
  paymentMethod: 'manual',
  placedAt: new Date(now.getTime() - 5 * 60_000),
}

describe('repeatCheckoutResult', () => {
  it('an unpaid duplicate: links Complete payment and Change payment method for its owner', () => {
    const r = repeatCheckoutResult(
      new DuplicateCheckout('unpaid', earlier, { sameContact: false, now }),
      'c1',
    )
    expect(r && 'error' in r ? r.error : null).toBe(
      'You already placed this order (#1042) and it is waiting for payment. Please pay for it to confirm it.',
    )
    const links = r && 'error' in r ? (r.links ?? []) : []
    expect(links.map((l) => l.label)).toEqual(['Pay for this order', 'Change payment method'])
    expect(links[0]?.href).toMatch(/^\/checkout\/thank-you\/1042\?t=/)
  })

  it('an unpaid checkout draft is named #D57 and linked to pay that draft', () => {
    const draft = { ...earlier, id: 'd1', number: -57, draftNumber: 57, paymentMethod: 'razorpay' }
    const r = repeatCheckoutResult(
      new DuplicateCheckout('unpaid', draft, { sameContact: true, now }),
      null,
    )
    expect(r && 'error' in r ? r.error : null).toBe(
      'You already placed this order (#D57) and it is waiting for payment. Please pay for it to confirm it.',
    )
    const links = r && 'error' in r ? (r.links ?? []) : []
    expect(links.map((l) => l.label)).toEqual(['Pay for this order'])
    expect(links[0]?.href).toMatch(/^\/checkout\/thank-you\/D57\?t=/)
  })

  it('never links someone else’s order: another signed-in shopper or a guest with one match', () => {
    const r = repeatCheckoutResult(
      new DuplicateCheckout('unpaid', earlier, { sameContact: false, now }),
      'someone-else',
    )
    expect(r && 'error' in r ? r.links : null).toEqual([])
  })

  it('a placed duplicate asks first, with View my order for a guest whose email and phone match', () => {
    const r = repeatCheckoutResult(
      new DuplicateCheckout(
        'placed',
        { ...earlier, paymentMethod: 'razorpay' },
        { sameContact: true, now },
      ),
      null,
    )
    expect(r && 'confirmAgain' in r ? r.confirmAgain.message : null).toBe(
      'You ordered this 5 minutes ago (#1042). Order again?',
    )
    expect(r && 'confirmAgain' in r ? r.confirmAgain.links.map((l) => l.label) : []).toEqual([
      'View my order',
    ])
  })

  it('names the unpaid transfer and the hourly cap', () => {
    const t = repeatCheckoutResult(
      new UnpaidTransferExists({ id: 'o1', number: 7, customerId: null }),
      null,
    )
    expect(t && 'error' in t ? t.error : null).toBe(
      'You already have an unpaid order #7. Pay for it, or choose another payment method.',
    )
    const cap = repeatCheckoutResult(new TooManyUnpaidCheckouts(earlier), 'c1')
    expect(cap && 'error' in cap ? cap.error : null).toBe(
      'Too many unpaid orders. Please complete one first.',
    )
    expect(cap && 'error' in cap ? cap.links?.length : 0).toBe(1)
    expect(repeatCheckoutResult(new Error('boom'), null)).toBeNull()
  })
})
