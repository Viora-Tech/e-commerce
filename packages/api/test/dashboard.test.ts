import { createMerchantAuth } from '@commerce/auth'
import {
  createDb,
  customer,
  inventoryLevel,
  order,
  orderLine,
  product,
  store,
  variant,
} from '@commerce/db'
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

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('dashboard.summary', () => {
  it('windows sales and counts over the last 7 days vs the 7 before, and lists top and low-stock products', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    const [p] = await owner
      .insert(product)
      .values({ storeId: a.storeId, handle: 'mouse', title: 'Mouse', status: 'active' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({
        storeId: a.storeId,
        productId: p?.id as string,
        title: 'Default',
        pricePaise: 100000,
      })
      .returning()
    await owner
      .insert(inventoryLevel)
      .values({ storeId: a.storeId, variantId: v?.id as string, onHand: 3, reserved: 1 })
    const [c] = await owner
      .insert(customer)
      .values({ storeId: a.storeId, name: 'Asha', email: 'asha@example.com' })
      .returning()
    const base = { storeId: a.storeId, customerId: c?.id, subtotalPaise: 100000 }
    const [o1, o2, o3, o4] = await owner
      .insert(order)
      .values([
        { ...base, number: 1, totalPaise: 100000, status: 'paid', placedAt: daysAgo(1) },
        { ...base, number: 2, totalPaise: 50000, status: 'placed', placedAt: daysAgo(2) },
        { ...base, number: 3, totalPaise: 70000, status: 'cancelled', placedAt: daysAgo(3) },
        { ...base, number: 4, totalPaise: 20000, status: 'paid', placedAt: daysAgo(9) },
      ])
      .returning()
    await owner.insert(orderLine).values([
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        variantId: v?.id as string,
        quantity: 2,
        unitPricePaise: 50000,
      },
      {
        storeId: a.storeId,
        orderId: o2?.id as string,
        variantId: v?.id as string,
        quantity: 1,
        unitPricePaise: 50000,
      },
      {
        storeId: a.storeId,
        orderId: o3?.id as string,
        variantId: v?.id as string,
        quantity: 9,
        unitPricePaise: 1,
      },
      {
        storeId: a.storeId,
        orderId: o4?.id as string,
        variantId: v?.id as string,
        quantity: 1,
        unitPricePaise: 20000,
      },
    ])
    // Another store's order must never leak in.
    await owner.insert(order).values({
      storeId: b.storeId,
      number: 1,
      subtotalPaise: 999,
      totalPaise: 999999,
      status: 'paid',
      placedAt: daysAgo(1),
    })

    const s = await call(appRouter.dashboard.summary, undefined, { context: a.ctx })

    expect(s.sales).toEqual({ value: 150000, previous: 20000 })
    expect(s.orders).toEqual({ value: 2, previous: 1 })
    expect(s.pending).toEqual({ value: 1, previous: 0 })
    expect(s.cancelled).toEqual({ value: 1, previous: 0 })
    expect(s.report.customers).toBe(1)
    expect(s.report.products).toBe(1)
    expect(s.report.inStock).toBe(1)
    expect(s.report.outOfStock).toBe(0)
    expect(s.report.revenuePaise).toBe(170000)
    expect(s.report.thisWeek).toHaveLength(7)
    expect(s.report.thisWeek.reduce((n, d) => n + d.revenuePaise, 0)).toBe(150000)
    expect(s.report.lastWeek.reduce((n, d) => n + d.orders, 0)).toBe(1)
    expect(s.recentOrders.map((o) => o.number)).toEqual([1, 2, 3, 4])
    expect(s.topProducts).toEqual([
      expect.objectContaining({ title: 'Mouse', units: 4, revenuePaise: 170000, imageUrl: null }),
    ])
    expect(s.lowStock).toEqual([
      expect.objectContaining({ title: 'Mouse', variantTitle: 'Default', available: 2 }),
    ])
  })

  it('is all zeros for an empty store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const s = await call(appRouter.dashboard.summary, undefined, { context: a.ctx })
    expect(s.sales).toEqual({ value: 0, previous: 0 })
    expect(s.report.revenuePaise).toBe(0)
    expect(s.recentOrders).toEqual([])
    expect(s.topProducts).toEqual([])
    expect(s.lowStock).toEqual([])
  })
})
