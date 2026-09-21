import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it } from 'vitest'
import { ManualPaymentProvider, upiDeepLink } from './manual'

const config = {
  upiId: 'waimers@hdfcbank',
  payeeName: 'Waimers',
  bankName: 'HDFC Bank',
  accountName: 'Waimers',
  accountNumber: '50200012345678',
  ifsc: 'HDFC0001234',
}

describePaymentProvider('manual', { create: () => new ManualPaymentProvider(config) })

describe('manual payment', () => {
  it('builds a UPI deep link with the amount fixed and the order as the note', () => {
    const link = upiDeepLink({
      upiId: 'w@hdfc',
      payeeName: 'Waimers',
      amountPaise: 269900,
      note: 'Order 7',
    })
    const u = new URL(link)
    expect(u.protocol).toBe('upi:')
    expect(Object.fromEntries(u.searchParams)).toEqual({
      pa: 'w@hdfc',
      pn: 'Waimers',
      am: '2699.00',
      cu: 'INR',
      tn: 'Order 7',
    })
  })

  it('returns a manual session with UPI and bank instructions and a pending status', async () => {
    const p = new ManualPaymentProvider(config)
    const r = await p.createPayment({
      orderId: 'o1',
      orderNumber: 7,
      amountPaise: 269900,
      currency: 'INR',
      customer: {},
    })
    expect(r.status).toBe('pending')
    expect(r.session.kind).toBe('manual')
    if (r.session.kind === 'manual') {
      expect(r.session.instructions.reference).toBe('Order 7')
      expect(r.session.instructions.upi?.id).toBe('waimers@hdfcbank')
      expect(r.session.instructions.bank?.ifsc).toBe('HDFC0001234')
    }
  })

  it('omits UPI when only bank details are configured', async () => {
    const p = new ManualPaymentProvider({
      bankName: 'HDFC',
      accountName: 'W',
      accountNumber: '1',
      ifsc: 'HDFC0001234',
    })
    const r = await p.createPayment({
      orderId: 'o1',
      amountPaise: 100,
      currency: 'INR',
      customer: {},
    })
    if (r.session.kind === 'manual') {
      expect(r.session.instructions.upi).toBeUndefined()
      expect(r.session.instructions.bank).toBeDefined()
    }
  })
})
