import { describe, expect, it } from 'vitest'
import { FakePaymentProvider } from './payment'

const input = { orderId: 'o1', amountPaise: 100, currency: 'INR' as const, customer: {} }

describe('FakePaymentProvider', () => {
  it('captures at creation and can refund by reference, recording every call', async () => {
    const p = new FakePaymentProvider()
    const created = await p.createPayment(input)
    expect(created).toMatchObject({ providerRef: 'fake_1', status: 'captured' })
    expect(created.session.kind).toBe('none')
    expect(await p.fetchStatus('fake_1')).toMatchObject({ status: 'captured' })
    expect(await p.refund('fake_1', 100)).toEqual({
      providerRefundId: 'rf_fake_1',
      status: 'processed',
    })
    expect(p.calls).toEqual(['createPayment:o1:100', 'refund:fake_1:100'])
  })

  it('declines in fail mode without issuing a reference', async () => {
    const p = new FakePaymentProvider({ mode: 'fail' })
    await expect(p.createPayment(input)).rejects.toThrow('fake gateway declined')
    expect(p.calls).toEqual(['createPayment:o1:100'])
  })
})
