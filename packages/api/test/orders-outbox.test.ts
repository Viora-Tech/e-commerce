import { createMerchantAuth } from '@commerce/auth'
import { createDb, order, outboxEvent, store, withStore } from '@commerce/db'
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

const ctx = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), storeId: s?.id as string }
}

async function seedOrder(storeId: string, opts: { importedFrom?: string } = {}) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1,
      status: 'placed',
      paymentMethod: 'cod',
      subtotalPaise: 10_000,
      totalPaise: 10_000,
      importedFrom: opts.importedFrom,
    })
    .returning()
  if (!o) throw new Error('seed')
  return o.id
}

async function outboxRows(storeId: string) {
  return withStore(app, storeId, (tx) =>
    tx.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId)),
  )
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('orders router writes the outbox instead of enqueueing directly', () => {
  it('setStatus(paid) on a live order writes one order.paid outbox row', async () => {
    const m = await merchant('a@example.com', 'outbox-live')
    const orderId = await seedOrder(m.storeId)

    const result = await call(
      appRouter.orders.setStatus,
      { id: orderId, status: 'paid' },
      { context: m.ctx },
    )
    expect(result?.status).toBe('paid')

    const rows = await outboxRows(m.storeId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'order.paid', payload: { orderId } })
  })

  it('setStatus on an imported order is refused and writes nothing', async () => {
    const m = await merchant('b@example.com', 'outbox-imported')
    const orderId = await seedOrder(m.storeId, { importedFrom: 'shopify' })

    await expect(
      call(appRouter.orders.setStatus, { id: orderId, status: 'paid' }, { context: m.ctx }),
    ).rejects.toThrow(/imported/i)

    const rows = await outboxRows(m.storeId)
    expect(rows).toHaveLength(0)
  })

  it('collectPayment on an imported order is refused and writes nothing', async () => {
    const m = await merchant('c@example.com', 'outbox-imported-pay')
    const orderId = await seedOrder(m.storeId, { importedFrom: 'shopify' })

    await expect(
      call(appRouter.orders.collectPayment, { orderId, amountPaise: 10_000 }, { context: m.ctx }),
    ).rejects.toThrow(/imported/i)

    const rows = await outboxRows(m.storeId)
    expect(rows).toHaveLength(0)
  })
})
