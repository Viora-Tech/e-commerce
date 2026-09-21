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
        status: 'paid',
        placedAt: daysAgo(20),
      },
      {
        ...base,
        customerId: asha?.id,
        number: 2,
        totalPaise: 50000,
        status: 'delivered',
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
        status: 'placed',
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
    expect(stats).toEqual({ total: 2, newThisWeek: 1, returning: 1, marketing: 1 })
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
          status: 'paid',
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
})
