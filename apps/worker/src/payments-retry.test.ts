/** A payment webhook whose processing threw answers 5xx after its transaction commits, so the gateway retries and the failure stays recorded (#1792). */
import type { Db } from '@commerce/db'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@commerce/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@commerce/core')>()),
  parsePaymentSettings: () => ({}),
  resolvePaymentProviders: () => ({ providers: [{ id: 'razorpay' }] }),
  handlePaymentWebhook: vi.fn(async () => ({
    ok: false,
    reason: 'processing failed: boom',
    retry: true,
  })),
}))
vi.mock('@commerce/core/registries', () => ({
  getRegistries: () => ({ owners: {} }),
  registriesForStore: async () => ({ payments: [] }),
}))

const { createMemoryRateLimitStore } = await import('@commerce/core')
const { paymentWebhooks } = await import('./payments')

const STORE = '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa'

describe('payment webhook processing failure', () => {
  it('commits, then answers 500 so the gateway retries', async () => {
    let committed = false
    const db = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const r = await fn({
          execute: async () => undefined,
          select: () => ({ from: () => ({ where: async () => [{ payments: {} }] }) }),
        })
        committed = true
        return r
      },
    } as unknown as Db
    const app = paymentWebhooks(db, 'secret-secret-secret', createMemoryRateLimitStore())
    const res = await app.request(`/webhooks/payments/razorpay/${STORE}`, {
      method: 'POST',
      body: '{}',
    })
    expect(committed).toBe(true)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false })
  })
})
