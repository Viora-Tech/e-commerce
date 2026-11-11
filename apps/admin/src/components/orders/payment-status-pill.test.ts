import { describe, expect, it } from 'vitest'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { type OrderPayment, type OrderRefund, paymentStatus } from './order-detail-types'

const pay = (status: string, amountPaise = 1000) =>
  ({ id: 'p1', status, amountPaise, refundNeeded: false }) as unknown as OrderPayment
const back = (amountPaise: number, status = 'processed') =>
  ({ id: `r${amountPaise}`, paymentId: 'p1', amountPaise, status }) as unknown as OrderRefund

describe('payment pill: partly vs fully refunded', () => {
  it('a part refund reads "partly refunded"', () => {
    expect(paymentStatus(pay('captured'), [back(300)])).toBe('partially_refunded')
  })

  it('"refunded" only once all of it went back', () => {
    expect(paymentStatus(pay('refunded'), [back(300), back(700)])).toBe('refunded')
  })

  it('a row a part refund webhook once set to refunded reads partly refunded', () => {
    expect(paymentStatus(pay('refunded'), [back(300)])).toBe('partially_refunded')
  })

  it('a failed refund does not count', () => {
    expect(paymentStatus(pay('captured'), [back(300, 'failed')])).toBe('captured')
    expect(paymentStatus(pay('refunded'), [back(300), back(700, 'failed')])).toBe(
      'partially_refunded',
    )
  })

  it('a payment refunded on the gateway dashboard (no refund rows) keeps its status', () => {
    expect(paymentStatus(pay('refunded'), [])).toBe('refunded')
  })

  it('says "Partly refunded"', () => {
    expect(orderDetailContent.pills.partiallyRefunded).toBe('Partly refunded')
    expect(ordersContent.paymentStatus.partially_refunded).toBe('Partly refunded')
  })
})
