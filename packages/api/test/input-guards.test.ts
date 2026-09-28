import { describe, expect, it } from 'vitest'
import { appRouter } from '../src/routers/_app'

/** The zod schema a procedure checks its input against, read without calling it. */
const inputOf = (procedure: unknown) =>
  (procedure as { '~orpc': { inputSchema: { safeParse: (v: unknown) => { success: boolean } } } })[
    '~orpc'
  ].inputSchema

describe('orders.fulfil tracking link', () => {
  const fulfil = inputOf(appRouter.orders.fulfil)
  const base = {
    orderId: '0190a0a0-0000-7000-8000-000000000000',
    lines: [{ lineId: '0190a0a0-0000-7000-8000-000000000001', quantity: 1 }],
  }

  it('takes a web link', () => {
    expect(
      fulfil.safeParse({ ...base, trackingUrl: 'https://www.delhivery.com/track/x' }).success,
    ).toBe(true)
  })

  it('refuses script and data links', () => {
    for (const trackingUrl of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x']) {
      expect(fulfil.safeParse({ ...base, trackingUrl }).success, trackingUrl).toBe(false)
    }
  })
})

describe('store.current', () => {
  it('never carries connector settings, which hold the encrypted secrets', async () => {
    const { presentStore } = await import('../src/services/store.service')
    const row = {
      id: 's1',
      name: 'Waimers',
      payments: { providers: { razorpay: { keySecret: 'v2.x' } } },
      notifications: {},
      shipping: {},
      storage: {},
      loginProviders: { google: { clientSecret: 'v2.y' } },
      apps: {},
    } as unknown as Parameters<typeof presentStore>[0]
    const shown = presentStore(row) as Record<string, unknown>
    for (const key of [
      'payments',
      'notifications',
      'shipping',
      'storage',
      'loginProviders',
      'apps',
    ]) {
      expect(shown, key).not.toHaveProperty(key)
    }
    expect(shown).toMatchObject({ id: 's1', name: 'Waimers' })
  })
})

describe('orders.collectPayment method', () => {
  const collect = inputOf(appRouter.orders.collectPayment)
  const base = { orderId: '0190a0a0-0000-7000-8000-000000000000', amountPaise: 100 }

  it('records hand-collected money as manual or COD only, never as a gateway', () => {
    expect(collect.safeParse({ ...base, method: 'cod' }).success).toBe(true)
    expect(collect.safeParse({ ...base, method: 'razorpay' }).success).toBe(false)
  })
})
