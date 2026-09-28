import { createMerchantAuth } from '@commerce/auth'
import { createDb, order, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
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

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

/** Signs in, creates the org, sets it active and returns the caller's headers. */
async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  return { headers, organizationId: org?.id as string }
}

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined } }
}

/** Moves a user onto a system role by slug, bypassing the API guards. */
async function setRole(storeId: string, userId: string, slug: string) {
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, storeId), eq(role.slug, slug)))
  if (!r) throw new Error(`no ${slug} role`)
  const existing = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  if (existing[0]) {
    await owner.update(storeMember).set({ roleId: r.id }).where(eq(storeMember.id, existing[0].id))
    return
  }
  await owner.insert(storeMember).values({ storeId, userId, roleId: r.id })
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store permissions', () => {
  it('lets the owner through and seeds the system roles on first use', async () => {
    const a = await merchant('owner@example.com', 'perm-a')
    const [s] = await owner
      .insert(store)
      .values({ slug: 'perm-a', name: 'A', organizationId: a.organizationId })
      .returning()
    if (!s) throw new Error('seed')

    const me = await call(appRouter.staff.me, {}, { context: ctx(a.headers) })
    expect(me.isOwner).toBe(true)
    expect(me.roleSlug).toBe('owner')

    const roles = await call(appRouter.staff.roles, {}, { context: ctx(a.headers) })
    expect(roles.map((r) => r.slug).sort()).toEqual(['admin', 'owner', 'staff'])
    expect(roles.find((r) => r.slug === 'owner')?.permissions).toContain('billing.manage')
  })

  it('refuses a staff member a settings change but allows an order update', async () => {
    const boss = await merchant('boss@example.com', 'perm-b')
    const [s] = await owner
      .insert(store)
      .values({ slug: 'perm-b', name: 'B', organizationId: boss.organizationId })
      .returning()
    if (!s) throw new Error('seed')
    // Seed the roles by making one owner call first.
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })

    const helperHeaders = await signIn('helper@example.com')
    const helperSession = await auth.api.getSession({ headers: helperHeaders })
    const helperId = helperSession?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    await setRole(s.id, helperId, 'staff')

    const me = await call(appRouter.staff.me, {}, { context: ctx(helperHeaders) })
    expect(me.roleSlug).toBe('staff')
    expect(me.isOwner).toBe(false)

    await expect(
      call(appRouter.store.updateGeneral, { name: 'Renamed' }, { context: ctx(helperHeaders) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const [o] = await owner
      .insert(order)
      .values({
        storeId: s.id,
        number: 1,
        email: 'shopper@example.com',
        status: 'open',
        subtotalPaise: 1000,
        totalPaise: 1000,
      })
      .returning()
    if (!o) throw new Error('seed order')

    const updated = await call(
      appRouter.orders.setStatus,
      { id: o.id, status: 'paid' },
      { context: ctx(helperHeaders) },
    )
    expect(updated?.paymentStatus).toBe('paid')

    // Editing the order's contact is fine; rewriting the customer's address book is not.
    await expect(
      call(
        appRouter.orders.updateContact,
        {
          orderId: o.id,
          name: 'Asha',
          email: 'shopper@example.com',
          phone: null,
          address: null,
          alsoUpdateCustomer: true,
        },
        { context: ctx(helperHeaders) },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('keeps cancelling behind its own grant', async () => {
    const boss = await merchant('boss2@example.com', 'perm-c')
    const [s] = await owner
      .insert(store)
      .values({ slug: 'perm-c', name: 'C', organizationId: boss.organizationId })
      .returning()
    if (!s) throw new Error('seed')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })

    const helperHeaders = await signIn('helper2@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    await setRole(s.id, helperId, 'staff')

    const [o] = await owner
      .insert(order)
      .values({
        storeId: s.id,
        number: 2,
        email: 'shopper@example.com',
        status: 'open',
        subtotalPaise: 1000,
        totalPaise: 1000,
      })
      .returning()
    if (!o) throw new Error('seed order')

    await expect(
      call(
        appRouter.orders.setStatus,
        { id: o.id, status: 'cancelled' },
        { context: ctx(helperHeaders) },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('stops a non owner granting more than they hold', async () => {
    const boss = await merchant('boss3@example.com', 'perm-d')
    const [s] = await owner
      .insert(store)
      .values({ slug: 'perm-d', name: 'D', organizationId: boss.organizationId })
      .returning()
    if (!s) throw new Error('seed')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })

    const helperHeaders = await signIn('helper3@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    await setRole(s.id, helperId, 'admin')

    // An administrator holds staff.invite but not staff.manage, so role editing is refused.
    await expect(
      call(
        appRouter.staff.saveRole,
        { name: 'Super', permissions: ['billing.manage'] },
        { context: ctx(helperHeaders) },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('guards collections with the product grants', async () => {
    const boss = await merchant('boss3@example.com', 'perm-d')
    const [s] = await owner
      .insert(store)
      .values({ slug: 'perm-d', name: 'D', organizationId: boss.organizationId })
      .returning()
    if (!s) throw new Error('seed')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })
    const made = await call(
      appRouter.collections.create,
      { title: 'Mice', kind: 'manual' },
      { context: ctx(boss.headers) },
    )

    const helperHeaders = await signIn('helper3@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    const as = { context: ctx(helperHeaders) }

    // Staff hold products.read only: they can look but not change anything.
    await setRole(s.id, helperId, 'staff')
    expect(await call(appRouter.collections.list, undefined, as)).toHaveLength(1)
    await expect(
      call(appRouter.collections.create, { title: 'Pads', kind: 'manual' }, as),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(
        appRouter.collections.update,
        { id: made.id, write: { title: 'Renamed', kind: 'manual' } },
        as,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.collections.reorder, { id: made.id, productIds: [] }, as),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(call(appRouter.collections.delete, { id: made.id }, as)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    // A role with no grants cannot even read them.
    const [bare] = await owner
      .insert(role)
      .values({ storeId: s.id, name: 'Bare', slug: 'bare' })
      .returning()
    if (!bare) throw new Error('seed role')
    await setRole(s.id, helperId, 'bare')
    await expect(call(appRouter.collections.list, undefined, as)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(call(appRouter.collections.get, { id: made.id }, as)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
