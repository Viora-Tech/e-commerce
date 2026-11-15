import { describe, expect, it } from 'vitest'
import { type OrderPayment, paidMethod } from './order-detail-types'

const pay = (provider: string, status: string) => ({ provider, status }) as unknown as OrderPayment

describe('paidMethod', () => {
  it('names the captured payment, not the method picked at checkout', () => {
    // #2475: chose UPI to your own ID, then paid by Razorpay on the second attempt.
    const order = {
      paymentMethod: 'manual',
      payments: [pay('manual', 'cancelled'), pay('razorpay', 'captured')],
    }
    expect(paidMethod(order)).toBe('razorpay')
  })

  it('falls back to the checkout method while nothing is captured', () => {
    expect(paidMethod({ paymentMethod: 'cod', payments: [pay('cod', 'pending')] })).toBe('cod')
    expect(paidMethod({ paymentMethod: null, payments: [] })).toBeNull()
  })
})
