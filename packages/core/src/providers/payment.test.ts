import { describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { FakePaymentProvider } from './payment'

const ctx = { storeId: 'store', tx: null } as unknown as StoreContext

describe('FakePaymentProvider', () => {
  it('captures, then can capture and refund by reference, recording every call', async () => {
    const p = new FakePaymentProvider()
    const created = await p.createPayment(ctx, { orderId: 'o1', amountPaise: 100, customer: {} })
    expect(created).toEqual({ providerRef: 'fake_1', status: 'captured' })
    expect(await p.capture(ctx, created.providerRef)).toEqual({ status: 'captured' })
    expect(await p.refund(ctx, created.providerRef, 100)).toEqual({ status: 'refunded' })
    expect(p.calls).toEqual(['createPayment:o1:100', 'capture:fake_1', 'refund:fake_1:100'])
  })

  it('declines in fail mode without issuing a reference', async () => {
    const p = new FakePaymentProvider({ mode: 'fail' })
    await expect(
      p.createPayment(ctx, { orderId: 'o1', amountPaise: 100, customer: {} }),
    ).rejects.toThrow('fake gateway declined')
    expect(p.calls).toEqual(['createPayment:o1:100'])
  })
})
