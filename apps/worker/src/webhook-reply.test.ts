import { createMemoryRateLimitStore } from '@commerce/core'
import type { Db } from '@commerce/db'
import type { Context, Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { paymentWebhooks } from './payments'
import { shipmentWebhooks } from './shipments-webhook'
import {
  isStoreId,
  peerAddress,
  WEBHOOK_REJECTED_BODY,
  WEBHOOK_REJECTED_STATUS,
} from './webhook-reply'

const STORE = '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa'

/** A database with no stores at all: `withStore` runs, the store lookup finds nothing. */
const emptyDb = {
  transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      execute: async () => undefined,
      select: () => ({ from: () => ({ where: async () => [] }) }),
    }),
} as unknown as Db

async function answer(app: Hono, path: string) {
  const res = await app.request(path, { method: 'POST', body: '{}' })
  return { status: res.status, body: await res.text() }
}

describe('peerAddress (D-01)', () => {
  const ctx = (env: unknown) =>
    ({ env, req: { raw: new Request('http://w/') } }) as unknown as Context

  it('reads the socket address Bun hands the app', () => {
    expect(peerAddress(ctx({ requestIP: () => ({ address: '203.0.113.9' }) }))).toBe('203.0.113.9')
  })

  it('is null outside Bun.serve', () => {
    expect(peerAddress(ctx(undefined))).toBeNull()
    expect(peerAddress(ctx({ requestIP: () => null }))).toBeNull()
  })
})

describe('webhook rejections (D-11)', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)

  it('accepts only uuid store ids', () => {
    expect(isStoreId(STORE)).toBe(true)
    expect(isStoreId('not-a-store')).toBe(false)
    expect(isStoreId(`${STORE}' or 1=1`)).toBe(false)
  })

  it('answers a malformed and an unknown store id the same way on the payment route', async () => {
    const app = paymentWebhooks(emptyDb, 'secret-secret-secret', createMemoryRateLimitStore())
    const malformed = await answer(app, '/webhooks/payments/razorpay/nope')
    const unknown = await answer(app, `/webhooks/payments/razorpay/${STORE}`)
    expect(malformed).toEqual(unknown)
    expect(malformed).toEqual({
      status: WEBHOOK_REJECTED_STATUS,
      body: JSON.stringify(WEBHOOK_REJECTED_BODY),
    })
  })

  it('answers a malformed and an unknown store id the same way on the courier route', async () => {
    const app = shipmentWebhooks(emptyDb, 'secret-secret-secret', createMemoryRateLimitStore())
    const malformed = await answer(app, '/webhooks/shipments/delhivery/nope')
    const unknown = await answer(app, `/webhooks/shipments/delhivery/${STORE}`)
    expect(malformed).toEqual(unknown)
    expect(malformed.status).toBe(WEBHOOK_REJECTED_STATUS)
    expect(malformed.body).not.toMatch(/store|provider|signature|uuid/i)
  })

  it('serves the neutral courier alias with the same answers as the named route', async () => {
    const app = shipmentWebhooks(emptyDb, 'secret-secret-secret', createMemoryRateLimitStore())
    const named = await answer(app, `/webhooks/shipments/shiprocket/${STORE}`)
    const alias = await answer(app, `/webhooks/shipments/c/sr/${STORE}`)
    const malformed = await answer(app, '/webhooks/shipments/c/sr/nope')
    const unknownCode = await answer(app, `/webhooks/shipments/c/zz/${STORE}`)
    // The route exists (not Hono's 404) and rejects an unknown store like the named one.
    expect(alias).toEqual(named)
    expect(malformed).toEqual(named)
    expect(unknownCode).toEqual(named)
    expect(alias.status).toBe(WEBHOOK_REJECTED_STATUS)
  })

  it('reaches the store lookup for a known alias code, and not for an unknown one', async () => {
    const lookups: string[] = []
    const spyDb = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          execute: async () => undefined,
          select: () => ({
            from: () => ({
              where: async () => {
                lookups.push('store')
                return []
              },
            }),
          }),
        }),
    } as unknown as Db
    const app = shipmentWebhooks(spyDb, 'secret-secret-secret', createMemoryRateLimitStore())
    await answer(app, `/webhooks/shipments/c/zz/${STORE}`)
    expect(lookups).toEqual([])
    await answer(app, `/webhooks/shipments/c/sr/${STORE}`)
    expect(lookups).toEqual(['store'])
  })
})
