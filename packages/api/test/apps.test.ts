import { createMerchantAuth } from '@commerce/auth'
import { builtInPaymentRegistry } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
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
