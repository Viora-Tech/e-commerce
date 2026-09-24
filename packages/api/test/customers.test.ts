import { createMerchantAuth } from '@commerce/auth'
import { createDb, customer, notification, order, store } from '@commerce/db'
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

describe('customers', () => {
  it('lists customers with order totals, segments and stats, scoped to the store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        {
          storeId: a.storeId,
          name: 'Asha Menon',
          email: 'asha@example.com',
          createdAt: daysAgo(30),
          acceptsMarketing: true,
        },
        { storeId: a.storeId, name: 'Ravi Iyer', email: 'ravi@example.com', createdAt: daysAgo(1) },
        { storeId: b.storeId, name: 'Other Store', email: 'other@example.com' },
      ])
      .returning()
    const base = { storeId: a.storeId, subtotalPaise: 1 }
    await owner.insert(order).values([
      {
        ...base,
        customerId: asha?.id,
        number: 1,
        totalPaise: 150000,
        status: 'open',
        paymentStatus: 'paid',
        placedAt: daysAgo(20),
      },
      {
        ...base,
        customerId: asha?.id,
        number: 2,
        totalPaise: 50000,
        status: 'completed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'delivered',
        placedAt: daysAgo(2),
      },
      {
        ...base,
        customerId: asha?.id,
        number: 3,
        totalPaise: 99999,
        status: 'cancelled',
        placedAt: daysAgo(1),
      },
      {
        ...base,
        customerId: ravi?.id,
        number: 4,
        totalPaise: 20000,
        status: 'open',
        placedAt: daysAgo(1),
      },
    ])

    const list = await call(appRouter.customers.list, { sort: 'spent' }, { context: a.ctx })
    expect(list.total).toBe(2)
    expect(list.items.map((c) => c.name)).toEqual(['Asha Menon', 'Ravi Iyer'])
    expect(list.items[0]).toMatchObject({ orderCount: 3, spentPaise: 200000 })
    expect(list.items[1]).toMatchObject({ orderCount: 1, spentPaise: 20000 })

    const returning = await call(
      appRouter.customers.list,
      { segment: 'returning' },
      { context: a.ctx },
    )
    expect(returning.items.map((c) => c.email)).toEqual(['asha@example.com'])
    const fresh = await call(appRouter.customers.list, { segment: 'new' }, { context: a.ctx })
    expect(fresh.items.map((c) => c.email)).toEqual(['ravi@example.com'])
    const search = await call(appRouter.customers.list, { search: 'iyer' }, { context: a.ctx })
    expect(search.total).toBe(1)

    const stats = await call(appRouter.customers.stats, undefined, { context: a.ctx })
    expect(stats).toEqual({
      total: 2,
      // Asha joined 30 days ago, Ravi yesterday: one arrived inside the week.
      totalPrevious: 1,
      newThisMonth: 1,
      newLast7: 1,
      newPrevious7: 0,
      returning: 1,
      marketing: 1,
      averageLifetimePaise: 110000,
    })
  })

  it('returns a customer with orders, totals and messages sent to them, and updates tags and note', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [asha] = await owner
      .insert(customer)
      .values({ storeId: a.storeId, name: 'Asha Menon', email: 'asha@example.com' })
      .returning()
    const [o1] = await owner
      .insert(order)
      .values([
        {
          storeId: a.storeId,
          customerId: asha?.id,
          number: 1,
          subtotalPaise: 1,
          totalPaise: 150000,
          status: 'open',
          paymentStatus: 'paid',
          placedAt: daysAgo(5),
        },
        {
          storeId: a.storeId,
          customerId: asha?.id,
          number: 2,
          subtotalPaise: 1,
          totalPaise: 70000,
          status: 'cancelled',
          placedAt: daysAgo(1),
        },
      ])
      .returning()
    await owner.insert(notification).values({
      storeId: a.storeId,
      orderId: o1?.id as string,
      channel: 'log',
      template: 'order_placed',
      to: 'asha@example.com',
      status: 'sent',
    })

    const c = await call(appRouter.customers.get, { id: asha?.id as string }, { context: a.ctx })
    expect(c?.orders.map((o) => o.number)).toEqual([2, 1])
    expect(c?.totals).toMatchObject({ orderCount: 2, spentPaise: 150000 })
    expect(c?.notifications.map((n) => n.template)).toEqual(['order_placed'])

    const updated = await call(
      appRouter.customers.update,
      { id: asha?.id as string, tags: ['vip', 'bengaluru'], note: 'Prefers evening delivery' },
      { context: a.ctx },
    )
    expect(updated).toMatchObject({ tags: ['vip', 'bengaluru'], note: 'Prefers evening delivery' })

    const missing = await call(
      appRouter.customers.get,
      { id: '00000000-0000-7000-8000-000000000000' },
      { context: a.ctx },
    )
    expect(missing).toBeNull()
  })

  it('filters by state, spend, orders, marketing and tag', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        {
          storeId: a.storeId,
          name: 'Asha Menon',
          email: 'asha@example.com',
          acceptsMarketing: true,
          tags: ['vip'],
          defaultAddress: {
            name: 'Asha Menon',
            line1: '12 MG Road',
            city: 'Mumbai',
            stateCode: 'MH',
            pincode: '400001',
          },
        },
        {
          storeId: a.storeId,
          name: 'Ravi Iyer',
          email: 'ravi@example.com',
          defaultAddress: {
            name: 'Ravi Iyer',
            line1: '9 Church Street',
            city: 'Kochi',
            stateCode: 'KL',
            pincode: '682001',
          },
        },
      ])
      .returning()
    const base = {
      storeId: a.storeId,
      subtotalPaise: 1,
      status: 'open' as const,
      paymentStatus: 'paid' as const,
    }
    await owner.insert(order).values([
      { ...base, customerId: asha?.id, number: 1, totalPaise: 300000, placedAt: daysAgo(3) },
      { ...base, customerId: asha?.id, number: 2, totalPaise: 100000, placedAt: daysAgo(2) },
      { ...base, customerId: ravi?.id, number: 3, totalPaise: 50000, placedAt: daysAgo(1) },
    ])

    const inMaharashtra = await call(
      appRouter.customers.list,
      { stateCode: 'MH' },
      { context: a.ctx },
    )
    expect(inMaharashtra.items.map((c) => c.email)).toEqual(['asha@example.com'])
    expect(inMaharashtra.items[0]).toMatchObject({ city: 'Mumbai', stateCode: 'MH' })

    const bigSpenders = await call(
      appRouter.customers.list,
      { minSpentPaise: 200000 },
      { context: a.ctx },
    )
    expect(bigSpenders.items.map((c) => c.email)).toEqual(['asha@example.com'])

    const repeat = await call(appRouter.customers.list, { minOrders: 2 }, { context: a.ctx })
    expect(repeat.items.map((c) => c.email)).toEqual(['asha@example.com'])

    const subscribed = await call(
      appRouter.customers.list,
      { acceptsMarketing: true },
      { context: a.ctx },
    )
    expect(subscribed.items.map((c) => c.email)).toEqual(['asha@example.com'])

    const tagged = await call(appRouter.customers.list, { tag: 'vip' }, { context: a.ctx })
    expect(tagged.items.map((c) => c.email)).toEqual(['asha@example.com'])

    const cheap = await call(appRouter.customers.list, { maxSpentPaise: 60000 }, { context: a.ctx })
    expect(cheap.items.map((c) => c.email)).toEqual(['ravi@example.com'])
  })

  it('adds and removes a tag across a selection without touching other tags', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        { storeId: a.storeId, email: 'asha@example.com', tags: ['vip'] },
        { storeId: a.storeId, email: 'ravi@example.com', tags: [] },
      ])
      .returning()
    const ids = [asha?.id as string, ravi?.id as string]

    const added = await call(
      appRouter.customers.tagMany,
      { ids, tag: 'Wholesale', action: 'add' },
      { context: a.ctx },
    )
    expect(added.updated).toBe(2)
    const afterAdd = await call(appRouter.customers.list, {}, { context: a.ctx })
    expect(afterAdd.items.find((c) => c.email === 'asha@example.com')?.tags).toEqual([
      'vip',
      'wholesale',
    ])

    const again = await call(
      appRouter.customers.tagMany,
      { ids, tag: 'wholesale', action: 'add' },
      { context: a.ctx },
    )
    expect(again.updated).toBe(0)

    const removed = await call(
      appRouter.customers.tagMany,
      { ids, tag: 'wholesale', action: 'remove' },
      { context: a.ctx },
    )
    expect(removed.updated).toBe(2)
    const afterRemove = await call(appRouter.customers.list, {}, { context: a.ctx })
    expect(afterRemove.items.find((c) => c.email === 'asha@example.com')?.tags).toEqual(['vip'])
  })

  it('saves a segment, counts its members and previews rules before saving', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        { storeId: a.storeId, email: 'asha@example.com', tags: ['vip'] },
        { storeId: a.storeId, email: 'ravi@example.com' },
        { storeId: b.storeId, email: 'other@example.com', tags: ['vip'] },
      ])
      .returning()
    const base = {
      storeId: a.storeId,
      subtotalPaise: 1,
      status: 'open' as const,
      paymentStatus: 'paid' as const,
    }
    await owner.insert(order).values([
      { ...base, customerId: asha?.id, number: 1, totalPaise: 300000, placedAt: daysAgo(3) },
      { ...base, customerId: ravi?.id, number: 2, totalPaise: 10000, placedAt: daysAgo(1) },
    ])

    const rules = {
      match: 'all' as const,
      conditions: [{ field: 'spend' as const, op: 'gte' as const, value: '200000' }],
    }
    const preview = await call(appRouter.customers.previewSegment, { rules }, { context: a.ctx })
    expect(preview.total).toBe(1)
    expect(preview.sample.map((c) => c.email)).toEqual(['asha@example.com'])

    const saved = await call(
      appRouter.customers.saveSegment,
      { name: 'Big spenders', rules },
      { context: a.ctx },
    )
    expect(saved).toMatchObject({ name: 'Big spenders' })

    const list = await call(appRouter.customers.segments, undefined, { context: a.ctx })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Big spenders', customerCount: 1 })

    // The other store shares the rule shape but never the rows.
    const otherStore = await call(appRouter.customers.segments, undefined, { context: b.ctx })
    expect(otherStore).toHaveLength(0)

    const renamed = await call(
      appRouter.customers.saveSegment,
      { id: saved?.id as string, name: 'Top buyers', rules },
      { context: a.ctx },
    )
    expect(renamed).toMatchObject({ name: 'Top buyers' })

    await call(appRouter.customers.deleteSegment, { id: saved?.id as string }, { context: a.ctx })
    expect(await call(appRouter.customers.segments, undefined, { context: a.ctx })).toHaveLength(0)
  })

  it('keeps a customer with orders and deletes one without', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [withOrders, without] = await owner
      .insert(customer)
      .values([
        { storeId: a.storeId, email: 'asha@example.com' },
        { storeId: a.storeId, email: 'ravi@example.com' },
      ])
      .returning()
    await owner.insert(order).values({
      storeId: a.storeId,
      customerId: withOrders?.id,
      number: 1,
      subtotalPaise: 1,
      totalPaise: 1000,
      status: 'open',
      paymentStatus: 'paid',
    })

    const blocked = await call(
      appRouter.customers.delete,
      { id: withOrders?.id as string },
      { context: a.ctx },
    )
    expect(blocked).toEqual({ deleted: false, orders: 1 })

    const gone = await call(
      appRouter.customers.delete,
      { id: without?.id as string },
      { context: a.ctx },
    )
    expect(gone).toEqual({ deleted: true, orders: 0 })
    const list = await call(appRouter.customers.list, {}, { context: a.ctx })
    expect(list.items.map((c) => c.email)).toEqual(['asha@example.com'])
  })

  it('builds the overview from orders and the visitor source, one week against the last', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        {
          storeId: a.storeId,
          name: 'Asha Menon',
          email: 'asha@example.com',
          createdAt: daysAgo(3),
        },
        {
          storeId: a.storeId,
          name: 'Ravi Iyer',
          email: 'ravi@example.com',
          createdAt: daysAgo(10),
        },
      ])
      .returning()
    const base = { storeId: a.storeId, subtotalPaise: 1, totalPaise: 1000 }
    await owner.insert(order).values([
      // Asha ordered twice this week, so she is active and a repeat buyer.
      {
        ...base,
        customerId: asha?.id,
        number: 1,
        status: 'open',
        paymentStatus: 'paid',
        placedAt: daysAgo(3),
      },
      {
        ...base,
        customerId: asha?.id,
        number: 2,
        status: 'open',
        paymentStatus: 'paid',
        placedAt: daysAgo(1),
      },
      // Ravi bought once, last week only.
      {
        ...base,
        customerId: ravi?.id,
        number: 3,
        status: 'open',
        paymentStatus: 'paid',
        placedAt: daysAgo(9),
      },
      // Drafts are not activity.
      { ...base, customerId: ravi?.id, number: 4, status: 'draft', placedAt: daysAgo(1) },
    ])

    const asked: string[][] = []
    const ctx: ApiContext = {
      ...a.ctx,
      visitors: {
        live: async () => ({ last30: 0, perMinute: [] }),
        daily: async (_storeId, days) => {
          asked.push(days)
          return { perDay: days.map((_, i) => i + 1), total: days.length }
        },
      },
    }
    const overview = await call(appRouter.customers.overview, undefined, { context: ctx })

    expect(asked[0]).toHaveLength(14)
    expect(overview.thisWeek.days).toHaveLength(7)
    expect(overview.lastWeek.days).toHaveLength(7)
    // Asha only, counted once despite two orders; the draft never shows up.
    expect(overview.activeCustomers).toBe(1)
    expect(overview.repeatCustomers).toBe(1)
    expect(overview.thisWeek.activeCustomers.reduce((t, n) => t + n, 0)).toBe(2)
    expect(overview.lastWeek.activeCustomers.reduce((t, n) => t + n, 0)).toBe(1)
    // The stub hands back 1..14, so this week is 8..14 and the week before 1..7.
    expect(overview.shopVisitors).toBe(77)
    expect(overview.visitors).toEqual({ value: 77, previous: 28 })
    expect(overview.conversionRate).toBeCloseTo(2.6, 1)
  })

  it('reads zero visitors when no visitor source is wired', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const overview = await call(appRouter.customers.overview, undefined, { context: a.ctx })
    expect(overview.shopVisitors).toBe(0)
    expect(overview.conversionRate).toBe(0)
    expect(overview.thisWeek.shopVisitors).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
