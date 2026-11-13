import { createMerchantAuth } from '@commerce/auth'
import { createDb, order, orderNote, store } from '@commerce/db'
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
    .values({
      slug,
      name: 'Waimers',
      organizationId: org?.id as string,
      payments: { enabled: ['cod', 'razorpay'] },
    })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

async function seedOrder(storeId: string, n: number, set: Partial<typeof order.$inferInsert> = {}) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'open',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      email: 'riya@example.com',
      ...set,
    })
    .returning()
  return o?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('orders.requestOnlinePayment', () => {
  it('asks a COD shopper to pay online and records it', async () => {
    const m = await merchant('owner@waimers.in', 'waimers')
    const orderId = await seedOrder(m.storeId, 1001)
    const r = await call(appRouter.orders.requestOnlinePayment, { orderId }, { context: m.ctx })
    expect(r.requestedAt).toBeInstanceOf(Date)
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.payOnlineRequestedAt).not.toBeNull()
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.author)).toContain('owner@waimers.in')
  })

  it('refuses paid, cancelled, draft, imported and prepaid orders', async () => {
    const m = await merchant('owner@waimers.in', 'waimers')
    const cases: Partial<typeof order.$inferInsert>[] = [
      { paymentStatus: 'paid', checkoutPaidAt: new Date() },
      { status: 'cancelled' },
      { status: 'draft' },
      { importedFrom: 'shopify' },
      { paymentMethod: 'razorpay' },
    ]
    for (const [i, set] of cases.entries()) {
      const orderId = await seedOrder(m.storeId, 2000 + i, set)
      await expect(
        call(appRouter.orders.requestOnlinePayment, { orderId }, { context: m.ctx }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      const [o] = await owner.select().from(order).where(eq(order.id, orderId))
      expect(o?.payOnlineRequestedAt).toBeNull()
    }
  })

  it("never reaches another store's order", async () => {
    const a = await merchant('owner@waimers.in', 'waimers')
    const b = await merchant('owner@other.in', 'other')
    const orderId = await seedOrder(a.storeId, 3001)
    await expect(
      call(appRouter.orders.requestOnlinePayment, { orderId }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.payOnlineRequestedAt).toBeNull()
  })
})
