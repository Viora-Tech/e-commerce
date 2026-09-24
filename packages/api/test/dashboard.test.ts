import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  createDb,
  customer,
  inventoryAdjustment,
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
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000)

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
    const [addr] = await owner
      .insert(address)
      .values({
        storeId: a.storeId,
        name: 'Asha',
        line1: '12 MG Road',
        city: 'Bengaluru',
        stateCode: 'KA',
        pincode: '560001',
        phone: '9999999999',
      })
      .returning()
    const base = { storeId: a.storeId, customerId: c?.id, subtotalPaise: 100000 }
    const [o1, o2, o3, o4] = await owner
      .insert(order)
      .values([
        {
          ...base,
          number: 1,
          totalPaise: 100000,
          status: 'open',
          paymentStatus: 'paid',
          placedAt: hoursAgo(2),
          shippingAddressId: addr?.id,
        },
        { ...base, number: 2, totalPaise: 50000, status: 'open', placedAt: daysAgo(2) },
        { ...base, number: 3, totalPaise: 70000, status: 'cancelled', placedAt: daysAgo(3) },
        {
          ...base,
          number: 4,
          totalPaise: 20000,
          status: 'open',
          paymentStatus: 'paid',
          placedAt: daysAgo(9),
        },
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
      status: 'open',
      paymentStatus: 'paid',
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
    expect(s.report.thisWeek.days).toHaveLength(7)
    expect(s.report.thisWeek.revenuePaise.reduce((n, v) => n + v, 0)).toBe(150000)
    expect(s.report.lastWeek.revenuePaise.reduce((n, v) => n + v, 0)).toBe(20000)
    expect(s.report.thisWeek.customers.reduce((n, v) => n + v, 0)).toBe(1)
    expect(s.report.thisWeek.products.reduce((n, v) => n + v, 0)).toBe(1)
    expect(s.recentOrders.map((o) => o.number)).toEqual([1, 2, 3, 4])
    expect(s.topProducts).toEqual([
      expect.objectContaining({
        title: 'Mouse',
        units: 4,
        revenuePaise: 170000,
        imageUrl: null,
        pricePaise: 100000,
        inStock: true,
      }),
    ])
    expect(s.activity.ordersLast24h).toBe(1)
    expect(s.activity.perHour).toHaveLength(24)
    expect(s.activity.perHour.reduce((n, v) => n + v, 0)).toBe(1)
    expect(s.salesByState).toEqual([{ stateCode: 'KA', revenuePaise: 100000, orders: 1, share: 1 }])
    expect(s.lowStock).toEqual([
      expect.objectContaining({ title: 'Mouse', variantTitle: 'Default', available: 2 }),
    ])
    expect(s.liveVisitors).toEqual({ last30: 0, perMinute: Array.from({ length: 30 }, () => 0) })
    expect(s.latestProducts).toEqual([
      expect.objectContaining({ title: 'Mouse', pricePaise: 100000, imageUrl: null }),
    ])
  })

  it('buckets the report series by IST day and rebuilds stock from the adjustment log', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [p] = await owner
      .insert(product)
      .values({ storeId: a.storeId, handle: 'pad', title: 'Pad', status: 'active' })
      .returning()
    const [v1, v2] = await owner
      .insert(variant)
      .values([
        { storeId: a.storeId, productId: p?.id as string, title: 'Black', pricePaise: 1000 },
        { storeId: a.storeId, productId: p?.id as string, title: 'White', pricePaise: 1000 },
      ])
      .returning()
    await owner.insert(inventoryLevel).values([
      { storeId: a.storeId, variantId: v1?.id as string, onHand: 0, reserved: 0 },
      { storeId: a.storeId, variantId: v2?.id as string, onHand: 4, reserved: 0 },
    ])
    // Black sold out 2 days ago (5 -> 0); White was received 4 days ago (0 -> 4).
    await owner.insert(inventoryAdjustment).values([
      {
        storeId: a.storeId,
        variantId: v1?.id as string,
        delta: -5,
        reason: 'sold',
        createdAt: daysAgo(2),
      },
      {
        storeId: a.storeId,
        variantId: v2?.id as string,
        delta: 4,
        reason: 'received',
        createdAt: daysAgo(4),
      },
    ])
    // Two customers on one IST day, one the day before; one product just now.
    await owner.insert(customer).values([
      { storeId: a.storeId, name: 'A', email: 'a1@example.com', createdAt: daysAgo(1) },
      { storeId: a.storeId, name: 'B', email: 'b1@example.com', createdAt: daysAgo(1) },
      { storeId: a.storeId, name: 'C', email: 'c1@example.com', createdAt: daysAgo(2) },
    ])

    const s = await call(appRouter.dashboard.summary, undefined, { context: a.ctx })
    const week = s.report.thisWeek

    expect(week.days).toHaveLength(7)
    // Days are contiguous ISO dates ending today (IST).
    const istToday = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)
    expect(week.days.at(-1)).toBe(istToday)
    expect(new Set(week.days).size).toBe(7)
    expect(week.customers.reduce((n, x) => n + x, 0)).toBe(3)
    expect(Math.max(...week.customers)).toBe(2)
    expect(week.products.reduce((n, x) => n + x, 0)).toBe(1)
    expect(week.products.at(-1)).toBe(1)

    // Today: Black out, White in. Before the sale (3+ days ago): both in stock.
    expect(week.inStock.at(-1)).toBe(1)
    expect(week.outOfStock.at(-1)).toBe(1)
    expect(week.inStock.at(-4)).toBe(2)
    expect(week.outOfStock.at(-4)).toBe(0)
    // Before White was received (5+ days ago): Black in, White out; carried across quiet days.
    expect(week.inStock.at(-6)).toBe(1)
    expect(week.outOfStock.at(-6)).toBe(1)
    expect(week.inStock[0]).toBe(1)
    expect(week.outOfStock[0]).toBe(1)
    // Last week is entirely before both adjustments and carries the same state.
    expect(s.report.lastWeek.inStock.every((x) => x === 1)).toBe(true)
    expect(s.report.lastWeek.outOfStock.every((x) => x === 1)).toBe(true)
  })

  it('reads live visitors from the host when one is wired', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const perMinute = Array.from({ length: 30 }, (_, i) => (i === 29 ? 4 : 0))
    const ctx = { ...a.ctx, visitors: { live: async () => ({ last30: 4, perMinute }) } }
    const s = await call(appRouter.dashboard.summary, undefined, { context: ctx })
    expect(s.liveVisitors).toEqual({ last30: 4, perMinute })
  })

  it('is all zeros for an empty store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const s = await call(appRouter.dashboard.summary, undefined, { context: a.ctx })
    expect(s.sales).toEqual({ value: 0, previous: 0 })
    expect(s.report.revenuePaise).toBe(0)
    expect(s.recentOrders).toEqual([])
    expect(s.topProducts).toEqual([])
    expect(s.lowStock).toEqual([])
    expect(s.activity).toEqual({ ordersLast24h: 0, perHour: Array.from({ length: 24 }, () => 0) })
    expect(s.salesByState).toEqual([])
    expect(s.categories).toEqual([])
    expect(s.latestProducts).toEqual([])
  })
})
