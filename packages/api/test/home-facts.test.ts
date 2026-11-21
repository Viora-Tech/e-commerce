import { describe, expect, it } from 'vitest'
import { paymentMixMethod } from '../src/services/home-facts.service'

describe('paymentMixMethod', () => {
  it('uses what the gateway said first', () => {
    expect(paymentMixMethod('razorpay', 'upi')).toBe('upi')
    expect(paymentMixMethod('razorpay', 'card')).toBe('card')
    expect(paymentMixMethod('cashfree', 'cardless_emi')).toBe('emi')
    expect(paymentMixMethod('razorpay', 'paylater')).toBe('pay_later')
  })

  it('names the order method when the gateway said nothing', () => {
    expect(paymentMixMethod('cod', null)).toBe('cod')
    expect(paymentMixMethod('manual', null)).toBe('upi')
    expect(paymentMixMethod('store_credit', null)).toBe('store_credit')
    // A gateway that did not say how: an online payment, never a cut-off "Card, UPI or n…".
    expect(paymentMixMethod('razorpay', null)).toBe('online')
    expect(paymentMixMethod(null, null)).toBe('other')
  })
})
