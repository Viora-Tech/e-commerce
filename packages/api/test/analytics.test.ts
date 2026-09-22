import { createMerchantAuth } from '@commerce/auth'
import { address, cart, createDb, customer, order, store } from '@commerce/db'
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

/** Fixed sessions so conversion maths is checkable without Dragonfly. */
const visitors = {
  live: async () => ({ last30: 4, perMinute: Array.from({ length: 30 }, () => 0) }),
  daily: async (_storeId: string, days: string[]) => ({
    perDay: days.map(() => 0),
    total: 200,
  }),
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
    ctx: {
      db: app,
      auth,
      headers,
      notifications: { add: async () => undefined },
      visitors,
    } as ApiContext,
    storeId: s?.id as string,
  }
}

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('analytics.overview', () => {
  it('reports revenue, conversion and the funnel for the range, ignoring drafts and cancellations', async () => {
    const a = await merchant('a@example.com', 'store-a')
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
    await owner.insert(order).values([
      {
        ...base,
        number: 1,
        totalPaise: 100000,
        status: 'paid',
        paymentMethod: 'razorpay',
        placedAt: hoursAgo(2),
        shippingAddressId: addr?.id,
      },
      {
        ...base,
        number: 2,
        totalPaise: 60000,
        status: 'placed',
        paymentMethod: 'cod',
        placedAt: daysAgo(2),
        shippingAddressId: addr?.id,
      },
      { ...base, number: 3, totalPaise: 90000, status: 'cancelled', placedAt: daysAgo(3) },
      { ...base, number: 4, totalPaise: 40000, status: 'draft', placedAt: daysAgo(1) },
      // Outside a 7-day range, inside 30.
      { ...base, number: 5, totalPaise: 25000, status: 'paid', placedAt: daysAgo(12) },
    ])
    await owner.insert(cart).values([
      { storeId: a.storeId, status: 'open', email: 'someone@example.com' },
      { storeId: a.storeId, status: 'open' },
      { storeId: a.storeId, status: 'converted', email: 'asha@example.com' },
    ])

    const week = await call(
      appRouter.analytics.overview,
      { range: { key: '7d' } },
      { context: a.ctx },
    )
    const kpi = (id: string) => week.kpis.find((k) => k.id === id)
    expect(kpi('orders')?.value).toBe(2)
    expect(kpi('revenue')?.value).toBe(160000)
    expect(kpi('sessions')?.value).toBe(200)
    expect(kpi('conversion')?.value).toBeCloseTo(2 / 200)
    expect(kpi('aov')?.value).toBe(80000)
    expect(week.range.days).toHaveLength(7)

    const funnel = Object.fromEntries(week.funnel.map((s) => [s.id, s.value]))
    expect(funnel.sessions).toBe(200)
    expect(funnel.carts).toBe(3)
    expect(funnel.checkouts).toBe(2)
    expect(funnel.orders).toBe(2)

    const methods = Object.fromEntries(week.paymentMethods.map((m) => [m.method, m.orders]))
    expect(methods).toEqual({ razorpay: 1, cod: 1 })
    expect(week.salesByState[0]).toMatchObject({ stateCode: 'KA', orders: 2 })

    const month = await call(
      appRouter.analytics.overview,
      { range: { key: '30d' } },
      { context: a.ctx },
    )
    expect(kpiValue(month, 'orders')).toBe(3)
    expect(kpiValue(month, 'revenue')).toBe(185000)
    expect(month.salesOverTime.day).toHaveLength(30)
    expect(month.salesOverTime.week.length).toBeLessThan(month.salesOverTime.day.length)
  })

  it('keeps one store out of the other store numbers', async () => {
    const a = await merchant('a2@example.com', 'store-a2')
    const b = await merchant('b2@example.com', 'store-b2')
    await owner.insert(order).values({
      storeId: a.storeId,
      number: 1,
      subtotalPaise: 100000,
      totalPaise: 100000,
      status: 'paid',
      placedAt: hoursAgo(1),
    })
    const seen = await call(
      appRouter.analytics.overview,
      { range: { key: '7d' } },
      { context: b.ctx },
    )
    expect(kpiValue(seen, 'orders')).toBe(0)
    expect(kpiValue(seen, 'revenue')).toBe(0)
  })
})

describe('analytics.report', () => {
  it('breaks sales down by product and by day', async () => {
    const a = await merchant('c@example.com', 'store-c')
    await owner.insert(order).values([
      {
        storeId: a.storeId,
        number: 1,
        subtotalPaise: 50000,
        totalPaise: 50000,
        status: 'paid',
        placedAt: hoursAgo(3),
      },
      {
        storeId: a.storeId,
        number: 2,
        subtotalPaise: 30000,
        totalPaise: 30000,
        status: 'paid',
        placedAt: hoursAgo(4),
      },
    ])
    const overTime = await call(
      appRouter.analytics.report,
      { slug: 'sales-over-time', range: { key: '7d' } },
      { context: a.ctx },
    )
    expect(overTime.rows).toHaveLength(7)
    expect(overTime.totals).toEqual({ orders: 2, revenuePaise: 80000 })
    expect(overTime.rows.at(-1)).toMatchObject({ orders: 2, revenuePaise: 80000 })

    const unknown = await call(
      appRouter.analytics.report,
      { slug: 'not-a-report', range: { key: '7d' } },
      { context: a.ctx },
    )
    expect(unknown.slug).toBe('sales-over-time')
  })
})

describe('analytics.live', () => {
  it('counts open carts and the last hour of orders', async () => {
    const a = await merchant('d@example.com', 'store-d')
    await owner.insert(order).values([
      {
        storeId: a.storeId,
        number: 1,
        subtotalPaise: 20000,
        totalPaise: 20000,
        status: 'paid',
        placedAt: new Date(Date.now() - 10 * 60_000),
      },
      {
        storeId: a.storeId,
        number: 2,
        subtotalPaise: 30000,
        totalPaise: 30000,
        status: 'paid',
        placedAt: hoursAgo(5),
      },
    ])
    await owner.insert(cart).values({ storeId: a.storeId, status: 'open' })

    const live = await call(appRouter.analytics.live, undefined, { context: a.ctx })
    expect(live.visitors.last30).toBe(4)
    expect(live.activeCarts).toBe(1)
    expect(live.ordersLastHour).toBe(1)
    expect(live.revenueLastHourPaise).toBe(20000)
    expect(live.events.length).toBeGreaterThan(0)
  })
})

function kpiValue(result: { kpis: { id: string; value: number }[] }, id: string): number {
  return result.kpis.find((k) => k.id === id)?.value ?? -1
}
