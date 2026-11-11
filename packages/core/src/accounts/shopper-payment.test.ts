import { describe, expect, it } from 'vitest'
import { shopperPayment } from './orders'

const money = (paymentStatus: string) =>
  ({ paymentStatus, paymentMethod: 'razorpay', checkoutPaidAt: new Date() }) as Parameters<
    typeof shopperPayment
  >[0]

describe('the shopper sees partly vs fully refunded', () => {
  it('a part refund is "partly refunded", not "refunded"', () => {
    expect(shopperPayment(money('partially_refunded'), undefined)).toBe('partly_refunded')
  })

  it('"refunded" only when all of it went back', () => {
    expect(shopperPayment(money('refunded'), undefined)).toBe('refunded')
    expect(shopperPayment(money('paid'), undefined)).toBe('paid')
  })
})
