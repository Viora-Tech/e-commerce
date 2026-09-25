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
import { eq } from 'drizzle-orm'
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
          // `new Date()`, not `hoursAgo(2)`: guaranteed to land in "today" (IST) regardless of
          // when this test happens to run relative to the IST midnight boundary.
          placedAt: new Date(),
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

    // Needs you: o1 (today) and o4 (9 days ago) are paid but unfulfilled; o2 is unpaid so it
    // does not count; o3 is cancelled. Today's briefing only counts o1.
    expect(s.today.ordersCount).toBe(1)
    expect(s.today.salesPaise).toBe(100000)
    expect(s.today.toShipCount).toBe(1)
    expect(s.needsYou.ordersToShip.count).toBe(2)
    expect(s.needsYou.ordersToShip.href).toBe('/orders?status=unfulfilled')
    expect(s.needsYou.upiToVerify.count).toBe(0)
    expect(s.needsYou.gstQueued).toBeNull()
    expect(s.needsYou.lowStock.count).toBe(1)
    expect(s.needsYou.preorderBalanceDue.count).toBe(0)
    expect(s.needsYou.failedDeliveries).toBeNull()

    // Insight: sales this window (150000) vs the window before (20000).
    expect(s.insight.salesChange).toBeCloseTo((150000 - 20000) / 20000)
    expect(s.insight.bestSeller).toEqual({ title: 'Mouse', units: 4 })

    // Live view globe: only o1 carries a shipping address, and it is within the last 24h.
    expect(s.mapOrders).toEqual([
      expect.objectContaining({ number: 1, city: 'Bengaluru', stateCode: 'KA' }),
    ])

    // Payment mix, status mix and the hours heatmap read the last 30 days, cancelled orders
    // dropped from the mix (o3) but kept in the status mix's "cancelled" bucket.
    expect(s.paymentMix).toEqual([{ label: 'Other', count: 3 }])
    expect(s.statusMix).toEqual([
      { status: 'to_ship', count: 3 },
      { status: 'shipped', count: 0 },
      { status: 'delivered', count: 0 },
      { status: 'cancelled', count: 1 },
    ])
    expect(s.hoursHeatmap).toHaveLength(7)
    for (const row of s.hoursHeatmap) expect(row).toHaveLength(24)
    const heatmapTotal = s.hoursHeatmap.reduce((n, row) => n + row.reduce((m, v) => m + v, 0), 0)
    expect(heatmapTotal).toBe(3)

    // Today's sparkline: o1 placed just now is in one hourly bucket; yesterday has none.
    expect(s.today.hourly).toHaveLength(24)
    expect(s.today.hourly.reduce((n, v) => n + v, 0)).toBe(1)
    expect(s.yesterday.hourly).toHaveLength(24)
    expect(s.yesterday.hourly.reduce((n, v) => n + v, 0)).toBe(0)
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
    expect(s.today).toEqual({
      ordersCount: 0,
      salesPaise: 0,
      toShipCount: 0,
      hourly: Array.from({ length: 24 }, () => 0),
    })
    expect(s.needsYou).toEqual({
      ordersToShip: { count: 0, href: '/orders?status=unfulfilled' },
      upiToVerify: { count: 0, href: '/orders?status=pending_upi' },
      gstQueued: null,
      lowStock: { count: 0, href: '/products/inventory' },
      preorderBalanceDue: { count: 0, href: '/orders' },
      failedDeliveries: null,
    })
    expect(s.insight).toEqual({ salesChange: null, bestSeller: null })
    expect(s.mapOrders).toEqual([])
    expect(s.dispatch).toBeNull()
    expect(s.paymentMix).toEqual([])
    expect(s.statusMix).toEqual([
      { status: 'to_ship', count: 0 },
      { status: 'shipped', count: 0 },
      { status: 'delivered', count: 0 },
      { status: 'cancelled', count: 0 },
    ])
    expect(s.hoursHeatmap).toEqual(
      Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    )
    expect(s.today.hourly).toEqual(Array.from({ length: 24 }, () => 0))
    expect(s.yesterday.hourly).toEqual(Array.from({ length: 24 }, () => 0))
  })

  it('reads the dispatch location from the store address, for the globe arc origin', async () => {
    const a = await merchant('a@example.com', 'store-a')
    await owner
      .update(store)
      .set({ address: { line1: '1 Whitefield Rd', city: 'Bengaluru', state: 'Karnataka' } })
      .where(eq(store.id, a.storeId))

    const s = await call(appRouter.dashboard.summary, undefined, { context: a.ctx })

    expect(s.dispatch).toEqual({ city: 'Bengaluru', state: 'Karnataka' })
  })
})

describe('dashboard.charts', () => {
  it('buckets sales and order counts for the range against the same span before it, and lists top products by revenue', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [p1, p2] = await owner
      .insert(product)
      .values([
        { storeId: a.storeId, handle: 'mouse', title: 'Mouse', status: 'active' },
        { storeId: a.storeId, handle: 'pad', title: 'Pad', status: 'active' },
      ])
      .returning()
    const [v1, v2] = await owner
      .insert(variant)
      .values([
        { storeId: a.storeId, productId: p1?.id as string, title: 'Default', pricePaise: 100000 },
        { storeId: a.storeId, productId: p2?.id as string, title: 'Default', pricePaise: 20000 },
      ])
      .returning()
    const base = { storeId: a.storeId, subtotalPaise: 0 }
    const [inRange, , inPrevious] = await owner
      .insert(order)
      .values([
        { ...base, number: 1, totalPaise: 100000, status: 'open', placedAt: daysAgo(2) },
        { ...base, number: 2, totalPaise: 999999, status: 'open', placedAt: daysAgo(20) },
        { ...base, number: 3, totalPaise: 40000, status: 'open', placedAt: daysAgo(9) },
      ])
      .returning()
    await owner.insert(orderLine).values([
      {
        storeId: a.storeId,
        orderId: inRange?.id as string,
        variantId: v1?.id as string,
        quantity: 1,
        unitPricePaise: 100000,
      },
      {
        storeId: a.storeId,
        orderId: inPrevious?.id as string,
        variantId: v2?.id as string,
        quantity: 2,
        unitPricePaise: 20000,
      },
    ])

    const charts = await call(appRouter.dashboard.charts, { range: 7 }, { context: a.ctx })

    expect(charts.range).toBe(7)
    expect(charts.days).toHaveLength(7)
    expect(charts.salesPaise.reduce((n, v) => n + v, 0)).toBe(100000)
    expect(charts.orders.reduce((n, v) => n + v, 0)).toBe(1)
    // The order from 9 days ago falls in the previous 7-day span, not the current one.
    expect(charts.previousSalesPaise).not.toBeNull()
    expect(charts.previousSalesPaise?.reduce((n, v) => n + v, 0)).toBe(40000)
    // The order from 20 days ago is outside both spans.
    expect(
      (charts.salesPaise.reduce((n, v) => n + v, 0) as number) +
        (charts.previousSalesPaise?.reduce((n, v) => n + v, 0) ?? 0),
    ).toBe(140000)
    expect(charts.topProducts).toEqual([
      expect.objectContaining({ title: 'Mouse', units: 1, revenuePaise: 100000 }),
    ])
  })

  it('is all zeros with no previous-period data for a fresh store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const charts = await call(appRouter.dashboard.charts, { range: 30 }, { context: a.ctx })
    expect(charts.salesPaise.every((v) => v === 0)).toBe(true)
    expect(charts.orders.every((v) => v === 0)).toBe(true)
    expect(charts.previousSalesPaise).toBeNull()
    expect(charts.topProducts).toEqual([])
  })
})
