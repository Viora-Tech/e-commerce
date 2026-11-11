import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCashfreeOrderId, CASHFREE_TIMEOUT_MS, CashfreeProvider } from '../src/cashfree'

/** Faked HTTP only: none of these tests reaches Cashfree. */
const config = { appId: 'cf_test_app', secretKey: 'cf_test_secret', mode: 'test' as const }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const sign = (timestamp: string, body: string) =>
  createHmac('sha256', config.secretKey).update(`${timestamp}${body}`).digest('base64')

function signed(body: string) {
  const ts = String(Date.now())
  return {
    rawBody: body,
    headers: { 'x-webhook-signature': sign(ts, body), 'x-webhook-timestamp': ts },
  }
}

const refundWebhook = (status: string) =>
  JSON.stringify({
    type: 'REFUND_STATUS_WEBHOOK',
    data: {
      refund: {
        cf_refund_id: 42,
        cf_payment_id: 998877,
        refund_id: 'rf1',
        order_id: 'o7_1',
        refund_amount: 100,
        refund_status: status,
      },
    },
  })

afterEach(() => {
  vi.useRealTimers()
})

describe('refund status webhooks (#1593)', () => {
  it('give each status of one refund its own event id, so SUCCESS after ONHOLD is not a duplicate', () => {
    const p = new CashfreeProvider(config)
    const ids = ['PENDING', 'ONHOLD', 'SUCCESS', 'CANCELLED'].map((s) => {
      const r = p.parseWebhook(signed(refundWebhook(s)))
      if (!r.ok) throw new Error(r.reason)
      return r.eventId
    })
    expect(new Set(ids).size).toBe(4)
  })

  it('keep the same event id when Cashfree resends the same status', () => {
    const p = new CashfreeProvider(config)
    const a = p.parseWebhook(signed(refundWebhook('SUCCESS')))
    const b = p.parseWebhook(signed(refundWebhook('SUCCESS')))
    expect(a.ok && b.ok && a.eventId === b.eventId).toBe(true)
  })
})

describe('timeouts on Cashfree calls (#1594)', () => {
  it('gives up on a call Cashfree never answers, with a readable error', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const pending = p.fetchStatus('o7_1')
    const caught = pending.catch((err: unknown) => err)
    await vi.advanceTimersByTimeAsync(CASHFREE_TIMEOUT_MS + 1)
    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe(`Cashfree did not answer in ${CASHFREE_TIMEOUT_MS / 1000}s`)
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('a connection test that times out reads as "could not reach", not as bad keys', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const pending = p.testConnection()
    await vi.advanceTimersByTimeAsync(CASHFREE_TIMEOUT_MS + 1)
    const r = await pending
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/^Could not reach Cashfree: Cashfree did not answer/)
  })
})

describe('retrying a refund whose first reply was lost (#1595)', () => {
  it('reports the refund Cashfree already made under the same refund_id', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`)
      if (init.method === 'POST') {
        return jsonResponse(409, { message: 'refund with this refund_id already exists' })
      }
      return jsonResponse(200, {
        cf_refund_id: 77,
        refund_id: 'rfabc0',
        refund_amount: 100,
        refund_status: 'SUCCESS',
      })
    })
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.refund('pay_1', 10000, undefined, {
      providerRef: 'o7_1',
      refundKey: 'rf_abc_0',
    })
    expect(r).toEqual({ providerRefundId: '77', status: 'processed' })
    expect(calls).toEqual([
      'POST https://sandbox.cashfree.com/pg/orders/o7_1/refunds',
      'GET https://sandbox.cashfree.com/pg/orders/o7_1/refunds/rfabc0',
    ])
  })

  it('passes the error on when the existing refund is for another amount', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) =>
      init.method === 'POST'
        ? jsonResponse(409, { message: 'refund with this refund_id already exists' })
        : jsonResponse(200, {
            cf_refund_id: 77,
            refund_id: 'rfabc0',
            refund_amount: 50,
            refund_status: 'SUCCESS',
          }),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    await expect(
      p.refund('pay_1', 10000, undefined, { providerRef: 'o7_1', refundKey: 'rf_abc_0' }),
    ).rejects.toThrow('refund with this refund_id already exists')
  })

  it('passes the error on when no refund exists under that id', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) =>
      init.method === 'POST'
        ? jsonResponse(400, { message: 'refund_amount is more than the order amount' })
        : jsonResponse(404, { message: 'refund not found' }),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    await expect(
      p.refund('pay_1', 10000, undefined, { providerRef: 'o7_1', refundKey: 'rf_abc_0' }),
    ).rejects.toThrow('refund_amount is more than the order amount')
  })
})

describe('order ids for checkout drafts (#1596)', () => {
  it('carry the draft number, so two drafts whose ids start alike never share a Cashfree order id', () => {
    const a = buildCashfreeOrderId({
      orderId: '1a2b3c4d-0000-4000-8000-000000000001',
      draftNumber: 12,
      amountPaise: 100,
      currency: 'INR',
      customer: {},
      idempotencyKey: '1a2b3c4d-0000-4000-8000-000000000001:1',
    })
    const b = buildCashfreeOrderId({
      orderId: '1a2b3c4d-0000-4000-8000-000000000002',
      draftNumber: 13,
      amountPaise: 100,
      currency: 'INR',
      customer: {},
      idempotencyKey: '1a2b3c4d-0000-4000-8000-000000000002:1',
    })
    expect(a).toBe('d12_1a2b3c4d_1')
    expect(b).toBe('d13_1a2b3c4d_1')
  })
})
