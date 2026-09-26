import {
  builtInPaymentRegistry,
  decryptPaymentSettings,
  parsePaymentSettings,
} from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { cashfreeFactory } from '@commerce/payments-cashfree'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeRazorpayOAuth,
  connectPaymentGateway,
  paymentsSetup,
  savePaymentMethods,
  signOAuthState,
  testPaymentConnection,
  verifyOAuthState,
} from '../src/services/payments-setup.service'

const webhookUrlFor = (workerUrl: string, providerId: string, storeId: string) =>
  `${workerUrl}/webhooks/payments/${providerId}/${storeId}`

/**
 * Settings → Payments service. Gateways are never called: every network
 * request goes through a mocked fetch, and only the test DB is touched.
 */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const secret = 'test-secret-test-secret-test-secret-1234'
const env = {
  secret,
  previousSecrets: [],
  workerUrl: 'https://worker.example.com',
  storefrontUrl: 'https://shop.example.com',
  razorpayOAuth: false,
}

const registry = builtInPaymentRegistry().register(razorpayFactory).register(cashfreeFactory)

async function makeStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

async function savedSettings(storeId: string) {
  const [row] = await owner
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, storeId))
  return parsePaymentSettings(row?.payments)
}

const razorpayKeys = {
  keyId: 'rzp_test_abc123',
  keySecret: 'secret-value-1234',
  webhookSecret: 'whsec-value-5678',
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('OAuth state', () => {
  it('round-trips the store and mode, and refuses a tampered or expired state', () => {
    const now = new Date('2026-09-26T10:00:00Z')
    const state = signOAuthState({ storeId: 's1', mode: 'live' }, secret, now)
    expect(verifyOAuthState(state, secret, now)).toEqual({ storeId: 's1', mode: 'live' })
    expect(verifyOAuthState(state, 'another-secret-another-secret', now)).toBeNull()
    const [payload, mac] = state.split('.')
    const forged = Buffer.from(
      JSON.stringify({ storeId: 's2', mode: 'live', exp: Date.now() * 2 }),
    ).toString('base64url')
    expect(verifyOAuthState(`${forged}.${mac}`, secret, now)).toBeNull()
    expect(
      verifyOAuthState(`${payload}.${mac}`, secret, new Date(now.getTime() + 31 * 60_000)),
    ).toBeNull()
  })
})

describe('connectPaymentGateway', () => {
  it('makes the gateway the main way to get paid with the default methods, secrets encrypted', async () => {
    // A store that never saved payment settings: COD starts off, as agreed.
    const storeId = await makeStore('pay-connect')
    await withStore(app, storeId, (tx) =>
      connectPaymentGateway(tx, storeId, registry, env, 'razorpay', razorpayKeys),
    )
    const saved = await savedSettings(storeId)
    expect(saved.enabled[0]).toBe('razorpay')
    expect(saved.methods?.filter((m) => m.on).map((m) => m.id)).toEqual([
      'upi',
      'card',
      'netbanking',
    ])
    expect(saved.enabled).not.toContain('cod')
    expect(saved.providers.razorpay?.keySecret).not.toBe(razorpayKeys.keySecret)
    expect(decryptPaymentSettings(saved, secret).providers.razorpay?.keySecret).toBe(
      razorpayKeys.keySecret,
    )
  })

  it('keeps COD on for a store that had saved it on before connecting', async () => {
    const storeId = await makeStore('pay-connect-cod')
    await owner
      .update(store)
      .set({ payments: { enabled: ['cod'], providers: {} } })
      .where(eq(store.id, storeId))
    await withStore(app, storeId, (tx) =>
      connectPaymentGateway(tx, storeId, registry, env, 'razorpay', razorpayKeys),
    )
    const saved = await savedSettings(storeId)
    expect(saved.methods?.find((m) => m.id === 'cod')?.on).toBe(true)
    expect(saved.enabled).toEqual(['razorpay', 'cod'])
  })

  it('switching to Cashfree replaces Razorpay at checkout, keeps its keys, and sets the update URL', async () => {
    const storeId = await makeStore('pay-switch')
    await withStore(app, storeId, async (tx) => {
      await connectPaymentGateway(tx, storeId, registry, env, 'razorpay', razorpayKeys)
      await connectPaymentGateway(tx, storeId, registry, env, 'cashfree', {
        appId: 'TEST123',
        secretKey: 'cf-secret',
        mode: 'test',
      })
    })
    const saved = await savedSettings(storeId)
    expect(saved.enabled).toContain('cashfree')
    expect(saved.enabled).not.toContain('razorpay')
    expect(saved.providers.razorpay?.keyId).toBe(razorpayKeys.keyId)
    expect(saved.providers.cashfree?.notifyUrl).toBe(
      webhookUrlFor(env.workerUrl, 'cashfree', storeId),
    )
  })
})

describe('savePaymentMethods', () => {
  it('orders checkout by the method row and turns COD on or off', async () => {
    const storeId = await makeStore('pay-methods')
    await withStore(app, storeId, async (tx) => {
      await connectPaymentGateway(tx, storeId, registry, env, 'razorpay', razorpayKeys)
      await savePaymentMethods(tx, storeId, registry, env, [
        { id: 'cod', on: true },
        { id: 'upi', on: true },
        { id: 'card', on: false },
      ])
    })
    const saved = await savedSettings(storeId)
    expect(saved.enabled.slice(0, 2)).toEqual(['cod', 'razorpay'])
    expect(saved.methods?.map((m) => m.id)).toEqual([
      'cod',
      'upi',
      'card',
      'netbanking',
      'wallet',
      'emi',
    ])
  })

  it('drops the gateway from checkout when every online method is off', async () => {
    const storeId = await makeStore('pay-methods-off')
    const setup = await withStore(app, storeId, async (tx) => {
      await connectPaymentGateway(tx, storeId, registry, env, 'razorpay', razorpayKeys)
      await savePaymentMethods(tx, storeId, registry, env, [{ id: 'cod', on: true }])
      return paymentsSetup(tx, storeId, registry, ['razorpay'], env)
    })
    expect(setup.canTakeOnline).toBe(false)
    expect(setup.canTakePayments).toBe(true)
    expect(setup.primary?.problems.map((p) => p.code)).toContain('no_online_methods')
  })
})

describe('paymentsSetup', () => {
  it('shows the guide on a new store and reports test mode for a test key', async () => {
    const storeId = await makeStore('pay-setup')
    const fresh = await withStore(app, storeId, (tx) =>
      paymentsSetup(tx, storeId, registry, [], env),
    )
    expect(fresh.showSetup).toBe(true)
    expect(fresh.primary).toBeNull()
    const connected = await withStore(app, storeId, async (tx) => {
      await connectPaymentGateway(tx, storeId, registry, env, 'razorpay', razorpayKeys)
      return paymentsSetup(tx, storeId, registry, ['razorpay'], env)
    })
    expect(connected.showSetup).toBe(false)
    expect(connected.canTakeOnline).toBe(true)
    expect(connected.primary).toMatchObject({
      id: 'razorpay',
      mode: 'test',
      via: 'keys',
      problems: [],
    })
    expect(connected.settings.providers.razorpay?.keySecret).toMatch(/^••••/)
  })
})

describe('testPaymentConnection', () => {
  it('uses the saved secret when the form sends the masked one back', async () => {
    const storeId = await makeStore('pay-test-conn')
    const fetchMock = vi.fn(async () => new Response('{"message":"not found"}', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    await withStore(app, storeId, (tx) =>
      connectPaymentGateway(tx, storeId, registry, env, 'cashfree', {
        appId: 'TEST123',
        secretKey: 'cf-secret-9999',
        mode: 'test',
      }),
    )
    const result = await withStore(app, storeId, (tx) =>
      testPaymentConnection(tx, storeId, registry, env, 'cashfree', {
        appId: 'TEST123',
        secretKey: '••••9999',
        mode: 'test',
      }),
    )
    vi.unstubAllGlobals()
    expect(result.ok).toBe(true)
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Record<string, string>
    expect(headers['x-client-secret']).toBe('cf-secret-9999')
  })
})

describe('completeRazorpayOAuth', () => {
  it('saves the tokens encrypted and registers the webhook, all through mocked Razorpay', async () => {
    const storeId = await makeStore('pay-oauth')
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/token')) {
        return Response.json({
          access_token: 'acc-token',
          token_type: 'Bearer',
          expires_in: 7_776_000,
          public_token: 'rzp_test_oauth_pub',
          refresh_token: 'ref-token',
          razorpay_account_id: 'acc_123',
        })
      }
      return Response.json({ id: 'wh_1' })
    })
    const result = await withStore(app, storeId, (tx) =>
      completeRazorpayOAuth(
        tx,
        storeId,
        registry,
        env,
        { clientId: 'cid', clientSecret: 'csecret' },
        { code: 'code-1', mode: 'test', redirectUri: 'https://admin.example.com/cb' },
        fetchMock as unknown as typeof fetch,
      ),
    )
    expect(result).toEqual({ webhook: 'registered' })
    const saved = await savedSettings(storeId)
    expect(saved.enabled[0]).toBe('razorpay')
    const cfg = decryptPaymentSettings(saved, secret).providers.razorpay
    expect(cfg).toMatchObject({
      keyId: 'rzp_test_oauth_pub',
      accessToken: 'acc-token',
      webhookId: 'wh_1',
    })
    expect(saved.providers.razorpay?.accessToken).not.toBe('acc-token')
    const webhookCall = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(webhookCall[0]).toBe('https://api.razorpay.com/v2/accounts/acc_123/webhooks')
    expect(JSON.parse(String(webhookCall[1].body)).url).toBe(
      webhookUrlFor(env.workerUrl, 'razorpay', storeId),
    )
  })
})
