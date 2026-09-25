import { encryptSecret, ShippingRegistry } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { delhiveryFactory } from '@commerce/shipping-delhivery'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testShippingConnection } from '../src/services/shipping.service'

/**
 * Unit-level coverage for the Connect page's "Test connection" button. No
 * network call ever leaves this process: fetch is mocked, so this never
 * reaches real Delhivery. Runs against the shared test DB only for a store
 * row and settings - the app-level RPC (rate limiting, auth) is covered by
 * the router wiring in shipping.test.ts.
 */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-secret-test-secret-test-secret-1234'

const registry = new ShippingRegistry().register(delhiveryFactory)

const validFields = {
  apiToken: 'live-token',
  clientName: 'Acme',
  pickupLocationName: 'Acme Warehouse',
  originPincode: '110001',
  baseUrl: '',
  expressMode: 'false',
  webhookSecret: '',
}

async function makeStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
})
afterEach(() => {
  vi.unstubAllGlobals()
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('testShippingConnection', () => {
  it('reports success when Delhivery says the origin PIN is serviceable', async () => {
    const storeId = await makeStore('test-connect-ok')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ delivery_codes: [{ postal_code: { pin: 110001, cod: 'Y', pre_paid: 'Y' } }] }),
          { status: 200 },
        ),
      ),
    )
    const result = await withStore(app, storeId, (tx) =>
      testShippingConnection(tx, storeId, registry, secret, 'delhivery', validFields),
    )
    expect(result).toEqual({ ok: true, message: 'Connected - Delhivery serves 110001.' })
  })

  it('gives a precise message when Delhivery rejects the token', async () => {
    const storeId = await makeStore('test-connect-auth')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const result = await withStore(app, storeId, (tx) =>
      testShippingConnection(tx, storeId, registry, secret, 'delhivery', validFields),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain("didn't accept this token")
  })

  it('reports unserviceable without treating it as an error', async () => {
    const storeId = await makeStore('test-connect-unserviceable')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ delivery_codes: [] }), { status: 200 })),
    )
    const result = await withStore(app, storeId, (tx) =>
      testShippingConnection(tx, storeId, registry, secret, 'delhivery', validFields),
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain('does not currently serve')
  })

  it('rejects before calling out when a required field is missing', async () => {
    const storeId = await makeStore('test-connect-invalid')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = await withStore(app, storeId, (tx) =>
      testShippingConnection(tx, storeId, registry, secret, 'delhivery', {
        ...validFields,
        clientName: '',
      }),
    )
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('resolves a masked secret against the value already saved', async () => {
    const storeId = await makeStore('test-connect-masked')
    await owner
      .update(store)
      .set({
        shipping: {
          enabled: ['delhivery'],
          providers: { delhivery: { ...validFields, apiToken: encryptSecret('live-token', secret) } },
          policy: {},
        },
      })
      .where(eq(store.id, storeId))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ delivery_codes: [{ postal_code: { pin: 110001, cod: 'Y', pre_paid: 'Y' } }] }),
          { status: 200 },
        ),
      ),
    )
    const result = await withStore(app, storeId, (tx) =>
      testShippingConnection(tx, storeId, registry, secret, 'delhivery', {
        ...validFields,
        apiToken: '••••oken',
      }),
    )
    expect(result.ok).toBe(true)
  })
})
