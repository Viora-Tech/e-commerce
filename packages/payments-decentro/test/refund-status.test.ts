import { describe, expect, it, vi } from 'vitest'
import { DecentroProvider, refundStateOf } from '../src/decentro'

/** Faked HTTP only: none of these tests reaches Decentro. */
const config = {
  clientId: 'dc_client',
  clientSecret: 'dc_secret',
  consumerUrn: 'urn_1',
  mode: 'test' as const,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const notFound = () =>
  json(404, {
    api_status: 'FAILURE',
    message: 'No transaction found',
    response_key: 'error_no_transaction_found',
  })

describe('refundStateOf', () => {
  it('maps refund and plain statuses in any case', () => {
    expect(refundStateOf('REFUNDED')).toBe('processed')
    expect(refundStateOf('success')).toBe('processed')
    expect(refundStateOf('REFUND_FAILED')).toBe('failed')
    expect(refundStateOf('FAILED')).toBe('failed')
    expect(refundStateOf('PENDING')).toBe('pending')
    expect(refundStateOf('REFUND_INITIATED')).toBe('pending')
    expect(refundStateOf(undefined)).toBe('pending')
  })
})

describe('fetchRefundStatus', () => {
  it('asks the status API by the refund id, GET only, and reads REFUNDED as processed', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.method).toBe('GET')
      expect(url).toBe(
        'https://staging.api.decentro.tech/v3/payments/transaction/status?decentro_txn_id=DCTR123',
      )
      return json(200, { api_status: 'SUCCESS', data: { transaction_status: 'REFUNDED' } })
    })
    const p = new DecentroProvider(config, fetchImpl as unknown as typeof fetch)
    await expect(
      p.fetchRefundStatus({ providerRefundId: 'DCTR123', providerRef: 'DCTRPAY' }),
    ).resolves.toBe('processed')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reads REFUND_FAILED as failed', async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, { api_status: 'SUCCESS', data: { transaction_status: 'REFUND_FAILED' } }),
    )
    const p = new DecentroProvider(config, fetchImpl as unknown as typeof fetch)
    await expect(
      p.fetchRefundStatus({ providerRefundId: 'DCTR123', providerRef: 'DCTRPAY' }),
    ).resolves.toBe('failed')
  })

  it('falls back to our reference id when Decentro knows no transaction by that id', async () => {
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url)
      return url.includes('decentro_txn_id')
        ? notFound()
        : json(200, { api_status: 'SUCCESS', data: { transaction_status: 'REFUNDED' } })
    })
    const p = new DecentroProvider(config, fetchImpl as unknown as typeof fetch)
    await expect(
      p.fetchRefundStatus({ providerRefundId: 'rf-abc-0', providerRef: 'DCTRPAY' }),
    ).resolves.toBe('processed')
    expect(urls[1]).toContain('reference_id=rf-abc-0')
  })

  it('stays pending when neither lookup finds it, and passes other errors on', async () => {
    const p = new DecentroProvider(config, vi.fn(async () => notFound()) as unknown as typeof fetch)
    await expect(
      p.fetchRefundStatus({ providerRefundId: 'x', providerRef: 'DCTRPAY' }),
    ).resolves.toBe('pending')

    const down = new DecentroProvider(
      config,
      vi.fn(async () => json(500, { message: 'Server error' })) as unknown as typeof fetch,
    )
    await expect(
      down.fetchRefundStatus({ providerRefundId: 'x', providerRef: 'DCTRPAY' }),
    ).rejects.toThrow('Server error')
  })
})
