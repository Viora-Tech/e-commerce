import { createMerchantAuth } from '@commerce/auth'
import {
  createDb,
  order,
  orderLine,
  outboxEvent,
  product,
  store,
  variant,
  withStore,
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

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
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

type Row = typeof order.$inferInsert

/** One order per tab, plus a draft that no tab may show. */
async function seedOrders(storeId: string) {
  const base = { storeId, subtotalPaise: 1000, totalPaise: 1000 }
  const rows: (Omit<Row, 'storeId' | 'subtotalPaise' | 'totalPaise'> & { number: number })[] = [
    { number: 1, status: 'open', paymentStatus: 'unpaid', paymentMethod: 'cod' },
    {
      number: 2,
      status: 'open',
      paymentStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      checkoutPaidAt: new Date(),
    },
    { number: 3, status: 'open', paymentStatus: 'unpaid', paymentMethod: 'manual' },
    {
      number: 4,
      status: 'completed',
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      checkoutPaidAt: new Date(),
    },
    { number: 5, status: 'cancelled', paymentStatus: 'refund_needed' },
    { number: 6, status: 'draft' },
    {
      number: 7,
      status: 'open',
      paymentStatus: 'partially_paid',
      fulfillmentStatus: 'partially_fulfilled',
      checkoutPaidAt: new Date(),
    },
  ]
  await owner.insert(order).values(rows.map((r) => ({ ...base, ...r })))
}

const numbers = async (m: Awaited<ReturnType<typeof merchant>>, input: object) => {
  const r = await call(
    appRouter.orders.list,
    { page: 1, perPage: 50, ...input },
    { context: m.ctx },
  )
  return r.items.map((o) => o.number).sort((a, b) => a - b)
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('order list tabs and filters on the split statuses', () => {
  it('each tab shows its orders and never a draft', async () => {
    const m = await merchant('tabs@example.com', 'tabs')
    await seedOrders(m.storeId)
    expect(await numbers(m, {})).toEqual([1, 2, 3, 4, 5, 7])
    expect(await numbers(m, { view: 'all' })).toEqual([1, 2, 3, 4, 5, 7])
    expect(await numbers(m, { view: 'unpaid' })).toEqual([1, 3, 7])
    expect(await numbers(m, { view: 'unfulfilled' })).toEqual([1, 3, 7])
    expect(await numbers(m, { view: 'pending_upi' })).toEqual([3])
    expect(await numbers(m, { view: 'completed' })).toEqual([4])
    expect(await numbers(m, { view: 'cancelled' })).toEqual([5])
  })

  it('filters by payment and fulfilment status, combined with a tab', async () => {
    const m = await merchant('filters@example.com', 'filters')
    await seedOrders(m.storeId)
    expect(await numbers(m, { paymentStatus: ['paid'] })).toEqual([2, 4])
    expect(await numbers(m, { paymentStatus: ['refund_needed', 'partially_paid'] })).toEqual([5, 7])
    expect(await numbers(m, { fulfillmentStatus: ['fulfilled', 'delivered'] })).toEqual([2, 4])
    expect(
      await numbers(m, { view: 'unpaid', fulfillmentStatus: ['partially_fulfilled'] }),
    ).toEqual([7])
    expect(await numbers(m, { status: 'open' })).toEqual([1, 2, 3, 7])
    await expect(
      call(
        appRouter.orders.list,
        { page: 1, perPage: 5, status: 'placed' as 'open' },
        {
          context: m.ctx,
        },
      ),
    ).rejects.toThrow()
  })

  it('the rows carry both derived statuses for the list pills', async () => {
    const m = await merchant('pills@example.com', 'pills')
    await seedOrders(m.storeId)
    const r = await call(appRouter.orders.list, { page: 1, perPage: 50 }, { context: m.ctx })
    expect(r.items.find((o) => o.number === 7)).toMatchObject({
      status: 'open',
      paymentStatus: 'partially_paid',
      fulfillmentStatus: 'partially_fulfilled',
    })
    const stats = await call(appRouter.orders.stats, undefined, { context: m.ctx })
    expect(stats.unpaid.value).toBe(3)
    expect(stats.delivered.value).toBe(1)
    expect(stats.cancelled.value).toBe(1)
  })

  it("never shows or changes another store's orders", async () => {
    const a = await merchant('iso-a@example.com', 'iso-a')
    const b = await merchant('iso-b@example.com', 'iso-b')
    await seedOrders(a.storeId)
    expect(await numbers(b, {})).toEqual([])
    expect(await numbers(b, { view: 'unpaid' })).toEqual([])
    const [target] = await owner.select().from(order).where(eq(order.number, 1))
    const moved = await call(
      appRouter.orders.setStatus,
      { id: target?.id as string, status: 'paid' },
      { context: b.ctx },
    )
    expect(moved).toBeNull()
    const [after] = await owner
      .select()
      .from(order)
      .where(eq(order.id, target?.id as string))
    expect(after?.paymentStatus).toBe('unpaid')
  })

  it('mark as fulfilled then delivered announces fulfilment once and completes a paid order', async () => {
    const m = await merchant('mark@example.com', 'mark')
    const [p] = await owner
      .insert(product)
      .values({ storeId: m.storeId, handle: 'pad', title: 'Pad' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({
        storeId: m.storeId,
        productId: p?.id as string,
        title: 'Default',
        pricePaise: 1000,
      })
      .returning()
    const [o] = await owner
      .insert(order)
      .values({ storeId: m.storeId, number: 1, subtotalPaise: 1000, totalPaise: 1000 })
      .returning()
    const id = o?.id as string
    await owner.insert(orderLine).values({
      storeId: m.storeId,
      orderId: id,
      variantId: v?.id as string,
      quantity: 1,
      unitPricePaise: 1000,
    })
    await call(appRouter.orders.setStatus, { id, status: 'paid' }, { context: m.ctx })
    const packed = await call(
      appRouter.orders.setStatus,
      { id, status: 'fulfilled' },
      { context: m.ctx },
    )
    expect(packed).toMatchObject({ status: 'open', fulfillmentStatus: 'fulfilled' })
    const done = await call(
      appRouter.orders.setStatus,
      { id, status: 'delivered' },
      { context: m.ctx },
    )
    expect(done).toMatchObject({
      status: 'completed',
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
    })
    const events = await withStore(app, m.storeId, (tx) => tx.select().from(outboxEvent))
    expect(events.map((e) => e.type).sort()).toEqual(['order.fulfilled', 'order.paid'])
  })
})
