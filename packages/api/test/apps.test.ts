import { createMerchantAuth } from '@commerce/auth'
import { builtInPaymentRegistry, recordAppActivity, recordAppError } from '@commerce/core'
import { appInstallation, createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { connectPaymentGateway } from '../src/services/payments-setup.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})
const env = {
  secret: 'test-secret-test-secret-test-secret-1234',
  previousSecrets: [],
  workerUrl: 'https://worker.example.com',
  storefrontUrl: 'https://shop.example.com',
  razorpayOAuth: false,
}
const registry = builtInPaymentRegistry().register(razorpayFactory)
const razorpayKeys = {
  keyId: 'rzp_test_abc123',
  keySecret: 'secret-value-1234',
  webhookSecret: 'whsec-value-5678',
}

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('apps.list', () => {
  it('never installed through Apps, no credentials: shows Install', async () => {
    const m = await merchant('a@example.com', 'store-a')
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    const razorpay = apps.find((a) => a.id === 'razorpay')
    expect(razorpay?.installed).toBe(false)
    expect(razorpay?.connected).toBe(false)
  })

  it('credentials saved directly in Settings, never through Apps → Install: still counts as installed and connected', async () => {
    const m = await merchant('b@example.com', 'store-b')
    await withStore(app, m.storeId, (tx) =>
      connectPaymentGateway(tx, m.storeId, registry, env, 'razorpay', razorpayKeys),
    )
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    const razorpay = apps.find((a) => a.id === 'razorpay')
    // Otherwise the gallery would show "Install" on a gateway that is already processing orders.
    expect(razorpay?.installed).toBe(true)
    expect(razorpay?.connected).toBe(true)
  })

  it('installed through Apps but no credentials yet: installed, not connected', async () => {
    const m = await merchant('c@example.com', 'store-c')
    await call(appRouter.apps.install, { id: 'razorpay' }, { context: m.ctx })
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    const razorpay = apps.find((a) => a.id === 'razorpay')
    expect(razorpay?.installed).toBe(true)
    expect(razorpay?.connected).toBe(false)
  })
})

describe('installed apps', () => {
  it('install keeps when and by whom; a connection without an account needs setup', async () => {
    const m = await merchant('d@example.com', 'store-d')
    await call(appRouter.apps.install, { id: 'delhivery' }, { context: m.ctx })
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    const delhivery = apps.find((a) => a.id === 'delhivery')
    expect(delhivery?.status).toBe('needsSetup')
    expect(delhivery?.installedAt).not.toBeNull()
    expect(typeof delhivery?.installedBy).toBe('string')
    expect(delhivery?.connectsIn).toBe('flow')
    expect(delhivery?.access.resources.map((r) => r.resource)).toContain('shipments')
  })

  it('a built-in app is connected once installed; apps not installed have no status', async () => {
    const m = await merchant('e@example.com', 'store-e')
    await call(appRouter.apps.install, { id: 'reviews' }, { context: m.ctx })
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    expect(apps.find((a) => a.id === 'reviews')?.status).toBe('connected')
    expect(apps.find((a) => a.id === 'forms')?.status).toBeNull()
  })

  it('install with the account typed in the flow saves it and connects the courier', async () => {
    const m = await merchant('f@example.com', 'store-f')
    const form = await call(appRouter.apps.connectForm, { id: 'delhivery' }, { context: m.ctx })
    expect(form?.fields.map((f) => f.key)).toEqual([
      'apiToken',
      'clientName',
      'pickupLocationName',
      'originPincode',
    ])
    await call(
      appRouter.apps.install,
      {
        id: 'delhivery',
        connect: {
          providerId: 'delhivery',
          fields: {
            apiToken: 'token-value-1234',
            clientName: 'Acme',
            pickupLocationName: 'Main',
            originPincode: '122001',
          },
        },
      },
      { context: m.ctx },
    )
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    expect(apps.find((a) => a.id === 'delhivery')?.status).toBe('connected')
    const [s] = await owner.select({ shipping: store.shipping }).from(store)
    const shipping = s?.shipping as { providers: Record<string, Record<string, string>> }
    // The token is stored encrypted, never as typed.
    expect(shipping.providers.delhivery?.apiToken).not.toBe('token-value-1234')
  })

  it('apps that connect on their own page have no flow form', async () => {
    const m = await merchant('g@example.com', 'store-g')
    const form = await call(appRouter.apps.connectForm, { id: 'ses' }, { context: m.ctx })
    expect(form).toBeNull()
  })

  it('disconnect switches the account off but keeps the app installed', async () => {
    const m = await merchant('h@example.com', 'store-h')
    await withStore(app, m.storeId, (tx) =>
      connectPaymentGateway(tx, m.storeId, registry, env, 'razorpay', razorpayKeys),
    )
    await call(appRouter.apps.disconnect, { id: 'razorpay' }, { context: m.ctx })
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    const razorpay = apps.find((a) => a.id === 'razorpay')
    expect(razorpay?.installed).toBe(true)
    expect(razorpay?.status).toBe('needsSetup')
  })

  it('a recorded failure shows as Error until cleared; activity shows as last activity', async () => {
    const m = await merchant('i@example.com', 'store-i')
    await call(appRouter.apps.install, { id: 'gst-invoices' }, { context: m.ctx })
    await withStore(app, m.storeId, async (tx) => {
      await recordAppActivity(tx, m.storeId, 'gst-invoices', 'Issued invoice INV-1')
      await recordAppError(tx, m.storeId, 'gst-invoices', 'Render failed')
    })
    let gst = (await call(appRouter.apps.list, undefined, { context: m.ctx })).find(
      (a) => a.id === 'gst-invoices',
    )
    expect(gst).toMatchObject({
      status: 'error',
      problem: 'Render failed',
      lastActivity: 'Issued invoice INV-1',
    })
    await withStore(app, m.storeId, (tx) =>
      recordAppActivity(tx, m.storeId, 'gst-invoices', null, { clearError: true }),
    )
    gst = (await call(appRouter.apps.list, undefined, { context: m.ctx })).find(
      (a) => a.id === 'gst-invoices',
    )
    expect(gst).toMatchObject({ status: 'connected', problem: null, lastActivity: null })
  })

  it('uninstallMany removes every app and its history', async () => {
    const m = await merchant('j@example.com', 'store-j')
    await call(appRouter.apps.install, { id: 'reviews' }, { context: m.ctx })
    await call(appRouter.apps.install, { id: 'forms' }, { context: m.ctx })
    await call(appRouter.apps.uninstallMany, { ids: ['reviews', 'forms'] }, { context: m.ctx })
    const apps = await call(appRouter.apps.list, undefined, { context: m.ctx })
    expect(apps.filter((a) => a.installed && !a.builtIn)).toEqual([])
    const rows = await owner.select().from(appInstallation)
    expect(rows).toEqual([])
  })
})
