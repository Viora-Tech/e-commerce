import { afterEach, describe, expect, it, vi } from 'vitest'
import { DECENTRO_TIMEOUT_MS } from '../src/client'
import { DecentroProvider } from '../src/decentro'

/** Faked HTTP only: none of these tests reaches Decentro. */
const config = {
  clientId: 'dc_client',
  clientSecret: 'dc_secret',
  consumerUrn: 'urn_1',
  mode: 'test' as const,
}

/** A fetch that never answers until its signal aborts it. */
const hangingFetch = () =>
  vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )

afterEach(() => {
  vi.useRealTimers()
})

describe('timeouts on Decentro calls (#1597)', () => {
  it('gives up on a status check Decentro never answers, with a readable error', async () => {
    vi.useFakeTimers()
    const fetchImpl = hangingFetch()
    const p = new DecentroProvider(config, fetchImpl as unknown as typeof fetch)
    const caught = p.fetchStatus('dtxn_1').catch((err: unknown) => err)
    await vi.advanceTimersByTimeAsync(DECENTRO_TIMEOUT_MS + 1)
    const err = await caught
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe(`Decentro did not answer in ${DECENTRO_TIMEOUT_MS / 1000}s`)
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('a payout refund that hangs fails instead of waiting for ever', async () => {
    vi.useFakeTimers()
    const p = new DecentroProvider(config, hangingFetch() as unknown as typeof fetch)
    const caught = p
      .refundViaPayout({
        toUpi: 'shopper@okbank',
        payeeName: 'Shopper',
        amountPaise: 10000,
        refundKey: 'rf_1_0',
      })
      .catch((err: unknown) => err)
    await vi.advanceTimersByTimeAsync(DECENTRO_TIMEOUT_MS + 1)
    expect(((await caught) as Error).message).toMatch(/^Decentro did not answer/)
  })

  it('a connection test that times out reads as "could not reach"', async () => {
    vi.useFakeTimers()
    const p = new DecentroProvider(config, hangingFetch() as unknown as typeof fetch)
    const pending = p.testConnection()
    await vi.advanceTimersByTimeAsync(DECENTRO_TIMEOUT_MS + 1)
    const r = await pending
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/^Could not reach Decentro: Decentro did not answer/)
  })
})
