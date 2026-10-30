import { describe, expect, it } from 'vitest'
import { anyManualRowLive, manualConfigForCheckout, manualRowReady } from './manual-rows'

const both = {
  upiId: 'shop@hdfcbank',
  payeeName: 'Shop',
  bankName: 'HDFC',
  accountName: 'Shop Pvt Ltd',
  accountNumber: '1234567890',
  ifsc: 'HDFC0001234',
  note: 'Quote your order number.',
}

describe('manual payment rows', () => {
  it('a store saved before the rows existed keeps both details and its note', () => {
    expect(manualConfigForCheckout(both, undefined)).toEqual(both)
  })

  it('a row that is off hides its details from the shopper', () => {
    const cfg = manualConfigForCheckout(both, { upi: { on: false }, bank: { on: true } })
    expect(cfg.upiId).toBeUndefined()
    expect(cfg.payeeName).toBeUndefined()
    expect(cfg.accountNumber).toBe('1234567890')
  })

  it("adds each live row's own instructions under the shared note", () => {
    const cfg = manualConfigForCheckout(both, {
      upi: { on: true, note: 'Pay within 24 hours.' },
      bank: { on: false, note: 'Never shown.' },
    })
    expect(cfg.note).toBe('Quote your order number.\nPay within 24 hours.')
  })

  it('is ready only with every detail the row needs', () => {
    expect(manualRowReady('upi', { upiId: 'a@b' })).toBe(false)
    expect(manualRowReady('upi', { upiId: 'a@b', payeeName: 'A' })).toBe(true)
    expect(manualRowReady('bank', { bankName: 'HDFC', accountNumber: '1', ifsc: 'X' })).toBe(false)
  })

  it('is live when one row is on with its details', () => {
    expect(anyManualRowLive(both, { upi: { on: false }, bank: { on: false } })).toBe(false)
    expect(anyManualRowLive({ upiId: 'a@b', payeeName: 'A' }, { bank: { on: true } })).toBe(true)
    expect(anyManualRowLive({ upiId: 'a@b', payeeName: 'A' }, { upi: { on: false } })).toBe(false)
  })
})
