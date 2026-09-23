import { createMerchantAuth } from '@commerce/auth'
import { createDb, order, payment, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

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

describe('redirects router', () => {
  it('creates, lists, rejects duplicates and bad input, and deletes', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const r = await call(
      appRouter.redirects.save,
      { path: 'Products/Old/', target: '/products/new' },
      { context: a.ctx },
    )
    expect(r.path).toBe('/products/old')
    await expect(
      call(appRouter.redirects.save, { path: '/products/old', target: '/x' }, { context: a.ctx }),
    ).rejects.toThrow(/already exists/)
    await expect(
      call(appRouter.redirects.save, { path: '/a', target: '/a' }, { context: a.ctx }),
    ).rejects.toThrow(/itself/)
    const list = await call(appRouter.redirects.list, { page: 1 }, { context: a.ctx })
    expect(list.total).toBe(1)

    const b = await merchant('b@example.com', 'store-b')
    const other = await call(appRouter.redirects.list, { page: 1 }, { context: b.ctx })
    expect(other.total).toBe(0)

    expect(await call(appRouter.redirects.delete, { ids: [r.id] }, { context: a.ctx })).toBe(1)
  })
})

describe('imported orders', () => {
  it('refuse fulfilment, status changes, collection and refunds but accept tags', async () => {
    const a = await merchant('o@example.com', 'store-o')
    const [o] = await owner
      .insert(order)
      .values({
        storeId: a.storeId,
        number: 1001,
        subtotalPaise: 50000,
        totalPaise: 50000,
        status: 'paid',
        importedFrom: 'shopify',
        importMeta: { name: '#1001', financialStatus: 'paid', fulfillmentStatus: null },
      })
      .returning()
    const [p] = await owner
      .insert(payment)
      .values({
        storeId: a.storeId,
        orderId: o?.id as string,
        provider: 'shopify',
        providerRef: '#1001',
        status: 'captured',
        amountPaise: 50000,
      })
      .returning()
    const id = o?.id as string
    await expect(
      call(appRouter.orders.setStatus, { id, status: 'fulfilled' }, { context: a.ctx }),
    ).rejects.toThrow(/read-only/)
    await expect(
      call(appRouter.orders.collectPayment, { orderId: id, amountPaise: 100 }, { context: a.ctx }),
    ).rejects.toThrow(/read-only/)
    await expect(
      call(
        appRouter.orders.refund,
        { paymentId: p?.id as string, amountPaise: 100 },
        { context: a.ctx },
      ),
    ).rejects.toThrow(/read-only/)
    await expect(
      call(appRouter.orders.createShipment, { orderId: id }, { context: a.ctx }),
    ).rejects.toThrow(/read-only/)
    await call(appRouter.orders.setTags, { id, tags: ['vip'] }, { context: a.ctx })
    const got = await call(appRouter.orders.get, { id }, { context: a.ctx })
    expect(got?.importedFrom).toBe('shopify')
    expect(got?.tags).toEqual(['vip'])
  })
})
