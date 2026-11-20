/** Razorpay refunds are idempotent on our refund key: a retry never refunds twice. Mocked client only. */
import { describe, expect, it, vi } from 'vitest'
import { RazorpayProvider } from '../src/razorpay'

const config = { keyId: 'rzp_test_offline', keySecret: 'offline-secret', webhookSecret: 'whsec_test' }

type RzpRefund = {
  id: string
  amount: number
  status: string
  receipt?: string | null
  notes?: Record<string, string> | unknown[]
}

/** A provider whose Razorpay client is a stand-in: refunds made are kept and listed back. */
function withRefunds(existing: RzpRefund[] = [], opts: { createFails?: boolean } = {}) {
  const p = new RazorpayProvider(config)
  const made: RzpRefund[] = [...existing]
  const create = vi.fn(async (_paymentId: string, body: Record<string, unknown>) => {
    const r: RzpRefund = {
      id: `rfnd_${made.length + 1}`,
      amount: body.amount as number,
      status: 'pending',
      receipt: (body.receipt as string | undefined) ?? null,
      notes: (body.notes as Record<string, string> | undefined) ?? [],
    }
    made.push(r)
    // The refund went through but the reply was lost on the way back.
    if (opts.createFails) throw new Error('socket hang up')
    return r
  })
  const list = vi.fn(async () => ({ entity: 'collection', count: made.length, items: made }))
  const client = (
    p as unknown as {
      client: { payments: { refund: typeof create; fetchMultipleRefund: typeof list } }
    }
  ).client
  client.payments.refund = create
  client.payments.fetchMultipleRefund = list
  return { p, create, list, made }
}

describe('razorpay refunds', () => {
  const key = 'rf_0123456789abcdef0123_0'

  it('sends our refund key as the receipt and in the notes', async () => {
    const { p, create } = withRefunds()
    const r = await p.refund('pay_1', 500, 'damaged', { refundKey: key })
    expect(r).toEqual({ providerRefundId: 'rfnd_1', status: 'pending' })
    expect(create).toHaveBeenCalledWith('pay_1', {
      amount: 500,
      receipt: key,
      notes: { note: 'damaged', refund_key: key },
    })
  })

  it('a retry with the same key returns the refund already made, not a second one', async () => {
    const { p, create } = withRefunds()
    await p.refund('pay_1', 500, undefined, { refundKey: key })
    const again = await p.refund('pay_1', 500, undefined, { refundKey: key })
    expect(again.providerRefundId).toBe('rfnd_1')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('finds an earlier refund by its notes when the receipt was not kept', async () => {
    const { p, create } = withRefunds([
      { id: 'rfnd_old', amount: 500, status: 'processed', notes: { refund_key: key } },
    ])
    const r = await p.refund('pay_1', 500, undefined, { refundKey: key })
    expect(r).toEqual({ providerRefundId: 'rfnd_old', status: 'processed' })
    expect(create).not.toHaveBeenCalled()
  })

  it('a lost reply is answered by looking the refund up again', async () => {
    const { p, create } = withRefunds([], { createFails: true })
    const r = await p.refund('pay_1', 500, undefined, { refundKey: key })
    expect(r.providerRefundId).toBe('rfnd_1')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('a refund with this key for another amount is not reused', async () => {
    const { p, create } = withRefunds([{ id: 'rfnd_x', amount: 100, status: 'processed', receipt: key }])
    await expect(p.refund('pay_1', 500, undefined, { refundKey: key })).rejects.toThrow(
      /another amount/,
    )
    expect(create).not.toHaveBeenCalled()
  })

  it('without a key it refunds once, as before', async () => {
    const { p, create, list } = withRefunds()
    await p.refund('pay_1', 500)
    expect(create).toHaveBeenCalledWith('pay_1', { amount: 500, notes: undefined })
    expect(list).not.toHaveBeenCalled()
  })
})
