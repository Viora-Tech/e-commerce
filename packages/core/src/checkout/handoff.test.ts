/** SOURCE OF TRUTH: checkout token tests — round-trip, tamper, expiry, malformed, and purpose separation (hand-off vs session) */
import { describe, expect, it } from 'vitest'
import {
  signCheckoutSession,
  signHandoffToken,
  verifyCheckoutSession,
  verifyHandoffToken,
} from './handoff'

const SECRET = 'test-handoff-secret-0123456789'
const H = { storeId: 'store-1', cartId: 'cart-1', customerId: 'cust-1' }

describe('checkout hand-off token', () => {
  it('round-trips the store, cart and customer', () => {
    const token = signHandoffToken(H, SECRET)
    expect(verifyHandoffToken(token, SECRET)).toEqual({
      ok: true,
      storeId: 'store-1',
      cartId: 'cart-1',
      customerId: 'cust-1',
    })
  })

  it('round-trips a guest (no customer) as null', () => {
    const token = signHandoffToken({ ...H, customerId: null }, SECRET)
    expect(verifyHandoffToken(token, SECRET)).toMatchObject({ ok: true, customerId: null })
  })

  it('rejects a tampered body', () => {
    const token = signHandoffToken(H, SECRET)
    const [storeId, , customerId, expires, mac] = token.split('.')
    const tampered = `${storeId}.other-cart.${customerId}.${expires}.${mac}`
    expect(verifyHandoffToken(tampered, SECRET)).toEqual({ ok: false, reason: 'signature' })
  })

  it('rejects an expired token', () => {
    const token = signHandoffToken(H, SECRET, 1000, new Date(0))
    expect(verifyHandoffToken(token, SECRET, new Date(2000))).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('rejects a malformed token', () => {
    expect(verifyHandoffToken('not.a.token', SECRET)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('does not accept a token signed for a different purpose (domain separation)', () => {
    // A token of the same shape but HMAC'd without the checkout-handoff purpose must fail.
    const token = signHandoffToken(H, SECRET)
    const underDifferentSecret = signHandoffToken(H, 'another-secret')
    expect(verifyHandoffToken(underDifferentSecret, SECRET)).toEqual({
      ok: false,
      reason: 'signature',
    })
    expect(verifyHandoffToken(token, SECRET)).toMatchObject({ ok: true })
  })
})

describe('checkout session token', () => {
  it('round-trips the store, cart and customer', () => {
    const token = signCheckoutSession(H, SECRET)
    expect(verifyCheckoutSession(token, SECRET)).toEqual({
      ok: true,
      storeId: 'store-1',
      cartId: 'cart-1',
      customerId: 'cust-1',
    })
  })

  it('is not interchangeable with a hand-off token (distinct purposes)', () => {
    expect(verifyCheckoutSession(signHandoffToken(H, SECRET), SECRET)).toEqual({
      ok: false,
      reason: 'signature',
    })
    expect(verifyHandoffToken(signCheckoutSession(H, SECRET), SECRET)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })
})
