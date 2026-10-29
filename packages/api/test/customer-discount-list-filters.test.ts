import { createMerchantAuth } from '@commerce/auth'
import { createDb, customer, discount, order, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
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
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
const iso = (d: Date) => d.toISOString()

function address(stateCode: string) {
  return { name: 'X', line1: '1 Road', city: 'City', stateCode, pincode: '400001' }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('customers list filters', () => {
  it('filters by states, tags, order range, dates and consent, with search and paging', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        {
          storeId: a.storeId,
          name: 'Asha',
          email: 'asha@example.com',
          tags: ['vip'],
          acceptsSms: true,
          defaultAddress: address('MH'),
          createdAt: daysAgo(100),
        },
        {
          storeId: a.storeId,
          name: 'Ravi',
          email: 'ravi@example.com',
          tags: ['wholesale'],
          acceptsWhatsapp: true,
          defaultAddress: address('KA'),
          createdAt: daysAgo(10),
        },
        {
          storeId: a.storeId,
          name: 'Meera',
          email: 'meera@example.com',
          defaultAddress: address('KL'),
          createdAt: daysAgo(2),
        },
      ])
      .returning()
    const base = {
      storeId: a.storeId,
      subtotalPaise: 1,
      totalPaise: 1000,
      status: 'open' as const,
      paymentStatus: 'paid' as const,
    }
    await owner.insert(order).values([
      { ...base, customerId: asha?.id, number: 1, placedAt: daysAgo(60) },
      { ...base, customerId: asha?.id, number: 2, placedAt: daysAgo(50) },
      { ...base, customerId: asha?.id, number: 3, placedAt: daysAgo(40) },
      { ...base, customerId: ravi?.id, number: 4, placedAt: daysAgo(5) },
    ])
    const list = async (input: Record<string, unknown>) =>
      (await call(appRouter.customers.list, input, { context: a.ctx })).items
        .map((c) => c.name)
        .sort()

    expect(await list({ stateCodes: ['mh', 'KA'] })).toEqual(['Asha', 'Ravi'])
    expect(await list({ tags: ['vip', 'wholesale'] })).toEqual(['Asha', 'Ravi'])
    expect(await list({ minOrders: 1, maxOrders: 2 })).toEqual(['Ravi'])
    expect(await list({ maxOrders: 0 })).toEqual(['Meera'])
    expect(await list({ createdFrom: iso(daysAgo(30)) })).toEqual(['Meera', 'Ravi'])
    expect(await list({ createdTo: iso(daysAgo(30)) })).toEqual(['Asha'])
    // No orders never matches a last-order window.
    expect(await list({ lastOrderFrom: iso(daysAgo(30)) })).toEqual(['Ravi'])
    expect(await list({ lastOrderTo: iso(daysAgo(30)) })).toEqual(['Asha'])
    expect(await list({ acceptsSms: true })).toEqual(['Asha'])
    expect(await list({ acceptsWhatsapp: false })).toEqual(['Asha', 'Meera'])
    // Combines with search and the other filters.
    expect(await list({ stateCodes: ['MH', 'KA'], search: 'ravi' })).toEqual(['Ravi'])
    expect(await list({ stateCodes: ['MH', 'KA', 'KL'], acceptsWhatsapp: false })).toEqual([
      'Asha',
      'Meera',
    ])

    const page = await call(
      appRouter.customers.list,
      { stateCodes: ['MH', 'KA', 'KL'], perPage: 2, page: 2 },
      { context: a.ctx },
    )
    expect(page.total).toBe(3)
    expect(page.items).toHaveLength(1)

    const exported = await call(
      appRouter.customers.export,
      { tags: ['vip'], lastOrderTo: iso(daysAgo(30)) },
      { context: a.ctx },
    )
    expect(exported.map((c) => c.id)).toEqual([asha?.id])
  })
})

describe('discounts list filters', () => {
  it('filters by status, type, method, active dates and usage, with search and paging', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const base = { storeId: a.storeId, value: 1000 }
    await owner.insert(discount).values([
      {
        ...base,
        title: 'Launch',
        kind: 'code',
        code: 'LAUNCH',
        type: 'order',
        method: 'percent',
        usedCount: 5,
        usageLimit: 5,
      },
      {
        ...base,
        title: 'Ship free',
        kind: 'automatic',
        type: 'shipping',
        method: 'free_shipping',
        usedCount: 2,
      },
      {
        ...base,
        title: 'Old sale',
        kind: 'code',
        code: 'OLD',
        type: 'products',
        method: 'fixed',
        startsAt: daysAgo(60),
        endsAt: daysAgo(40),
      },
      {
        ...base,
        title: 'Diwali',
        kind: 'code',
        code: 'DIWALI',
        type: 'order',
        method: 'percent',
        startsAt: new Date(Date.now() + 5 * 86_400_000),
      },
      {
        ...base,
        title: 'Paused',
        kind: 'code',
        code: 'PAUSED',
        type: 'bxgy',
        method: 'percent',
        status: 'disabled',
      },
    ])
    const list = async (input: Record<string, unknown>) =>
      (await call(appRouter.discounts.list, input, { context: a.ctx })).items
        .map((d) => d.title)
        .sort()

    expect(await list({ lifecycles: ['scheduled', 'expired'] })).toEqual(['Diwali', 'Old sale'])
    expect(await list({ types: ['shipping', 'products'] })).toEqual(['Old sale', 'Ship free'])
    expect(await list({ kinds: ['automatic'] })).toEqual(['Ship free'])
    // Ran at some point in the last 30 days: not the one that ended 40 days ago, nor next week's.
    expect(await list({ activeFrom: iso(daysAgo(30)), activeTo: iso(new Date()) })).toEqual([
      'Launch',
      'Paused',
      'Ship free',
    ])
    expect(await list({ usedMin: 1 })).toEqual(['Launch', 'Ship free'])
    expect(await list({ usedMax: 2, usedMin: 2 })).toEqual(['Ship free'])
    expect(await list({ limitReached: true })).toEqual(['Launch'])
    expect(await list({ limitReached: false })).toHaveLength(4)
    // Combines with the tab and search.
    expect(await list({ lifecycle: 'active', types: ['order'] })).toEqual(['Launch'])
    expect(await list({ kinds: ['code'], search: 'old' })).toEqual(['Old sale'])

    const page = await call(
      appRouter.discounts.list,
      { kinds: ['code'], perPage: 3, page: 2 },
      { context: a.ctx },
    )
    expect(page.total).toBe(4)
    expect(page.items).toHaveLength(1)
  })
})
