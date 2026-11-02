import { createMerchantAuth } from '@commerce/auth'
import type { StoreActivityQuery } from '@commerce/core'
import { createDb, store, storeActivity, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { recordChange } from '../src/procedures/activity'
import type { SessionContext } from '../src/procedures/base'
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
  return new Headers({
    cookie: res.headers.get('set-cookie') ?? '',
    'user-agent': 'vitest',
    'x-forwarded-for': '203.0.113.7, 10.0.0.1',
  })
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const session = await auth.api.getSession({ headers })
  const ctx = {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
  } as ApiContext
  return { ctx, storeId: s?.id as string, userId: session?.user.id as string }
}

/** Every activity row of a store, read past RLS. */
const rowsOf = (storeId: string) =>
  owner.select().from(storeActivity).where(eq(storeActivity.storeId, storeId))

const zone = (name: string) => ({
  name,
  stateCodes: ['BR'],
  pincodeRules: [],
  rates: [{ name: 'Standard', pricePaise: 4900 }],
})

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store activity log', () => {
  it('records a change with who made it, and nothing for a read', async () => {
    const a = await merchant('kinja@example.com', 'act-a')
    const created = await call(appRouter.shipping.zones.create, zone('Kinja'), { context: a.ctx })
    await call(appRouter.shipping.zones.list, undefined, { context: a.ctx })
    await call(appRouter.shipping.zones.get, { id: created.id }, { context: a.ctx })

    const rows = await rowsOf(a.storeId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      actorUserId: a.userId,
      actorEmail: 'kinja@example.com',
      source: 'admin',
      action: 'shipping.zones.create',
      area: 'settings',
      resourceType: 'shipping.zones',
      resourceId: created.id,
      ip: '203.0.113.7',
      userAgent: 'vitest',
    })
    expect(rows[0]?.summary).toContain('Kinja')
    expect(rows[0]?.changes).toMatchObject({ input: { name: 'Kinja', stateCodes: ['BR'] } })
  })

  it('keeps the fields an update changed, before and after', async () => {
    const a = await merchant('edit@example.com', 'act-edit')
    const created = await call(appRouter.shipping.zones.create, zone('Kinja'), { context: a.ctx })
    await call(
      appRouter.shipping.zones.update,
      { id: created.id, data: zone('Kinja Bihar') },
      { context: a.ctx },
    )
    const update = (await rowsOf(a.storeId)).find((r) => r.action === 'shipping.zones.update')
    expect(update?.changes).toEqual({ before: { name: 'Kinja' }, after: { name: 'Kinja Bihar' } })
  })

  it('writes nothing when the handler fails', async () => {
    const a = await merchant('fail@example.com', 'act-fail')
    await expect(
      call(
        appRouter.shipping.zones.update,
        { id: '0190f7a0-0000-7000-8000-000000000000', data: zone('Nowhere') },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      call(appRouter.shipping.zones.create, { ...zone(''), name: '' }, { context: a.ctx }),
    ).rejects.toThrow()
    // A delete that found nothing is skipped by its handler.
    await call(
      appRouter.shipping.zones.delete,
      { id: '0190f7a0-0000-7000-8000-000000000000' },
      { context: a.ctx },
    )
    expect(await rowsOf(a.storeId)).toEqual([])
  })

  it('never stores keys, tokens, passwords, OTPs or contact details', async () => {
    const a = await merchant('keys@example.com', 'act-keys')
    const session = await auth.api.getSession({ headers: a.ctx.headers })
    const context = {
      ...a.ctx,
      session: {
        user: { id: a.userId, email: 'keys@example.com', name: 'Keys' },
        activeOrganizationId: session?.session.activeOrganizationId ?? null,
        sessionId: 's',
      },
    } as unknown as SessionContext
    await withStore(app, a.storeId, (tx) =>
      recordChange(context, tx, a.storeId, {
        path: ['payments', 'saveMethods'],
        procedure: appRouter.payments.saveMethods,
        input: {
          gateway: 'razorpay',
          keyId: 'rzp_live_AbCdEf123456',
          keySecret: 'plain-secret-value',
          webhookSecret: 'whsec',
          password: 'hunter2',
          otp: '123456',
          note: 'mail ravi@example.com, token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
          customer: { email: 'ravi@example.com', phone: '+91 98765 43210', name: 'Ravi' },
          handle: 'mens-cotton-shirt-blue-large-xl',
        },
        output: { ok: true },
        note: {},
      }),
    )
    const [row] = await rowsOf(a.storeId)
    const text = JSON.stringify(row?.changes)
    for (const secret of [
      'rzp_live_AbCdEf123456',
      'plain-secret-value',
      'whsec',
      'hunter2',
      '123456',
      'ravi@example.com',
      '98765',
      'eyJhbGci',
    ]) {
      expect(text).not.toContain(secret)
    }
    expect(row?.changes).toMatchObject({
      input: {
        gateway: 'razorpay',
        customer: { name: 'Ravi' },
        handle: 'mens-cotton-shirt-blue-large-xl',
      },
    })
  })

  it('lists with filters, and a store sees only its own log', async () => {
    const a = await merchant('owner-a@example.com', 'act-list-a')
    const b = await merchant('owner-b@example.com', 'act-list-b')
    await call(appRouter.shipping.zones.create, zone('Kinja'), { context: a.ctx })
    await call(appRouter.shipping.zones.create, zone('Patna'), { context: a.ctx })
    await call(appRouter.shipping.zones.create, zone('Elsewhere'), { context: b.ctx })

    const list = (input: StoreActivityQuery = {}) =>
      call(appRouter.activityLog.list, input, { context: a.ctx })

    const all = await list()
    expect(all.total).toBe(2)
    expect(all.rows.map((r) => r.summary).join()).not.toContain('Elsewhere')
    expect((await list({ search: 'kinja' })).rows).toHaveLength(1)
    expect((await list({ search: 'shipping.zones' })).total).toBe(2)
    expect((await list({ area: 'settings' })).total).toBe(2)
    expect((await list({ area: 'orders' })).total).toBe(0)
    expect((await list({ actorUserId: a.userId })).total).toBe(2)
    expect((await list({ actorUserId: b.userId })).total).toBe(0)
    expect((await list({ source: 'mcp' })).total).toBe(0)
    expect((await list({ from: new Date(Date.now() + 60_000).toISOString() })).total).toBe(0)
    expect((await list({ to: new Date(Date.now() + 60_000).toISOString() })).total).toBe(2)
    expect((await list({ limit: 1, offset: 1 })).rows).toHaveLength(1)

    const people = await call(appRouter.activityLog.listPeople, undefined, { context: a.ctx })
    expect(people).toEqual([
      expect.objectContaining({ userId: a.userId, email: 'owner-a@example.com' }),
    ])

    // RLS: inside store B's context, store A's rows do not exist.
    const seenByB = await withStore(app, b.storeId, (tx) => tx.select().from(storeActivity))
    expect(seenByB.map((r) => r.storeId)).toEqual([b.storeId])
    const fromB = await call(appRouter.activityLog.list, {}, { context: b.ctx })
    expect(fromB.total).toBe(1)
  })
})
