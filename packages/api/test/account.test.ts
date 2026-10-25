import { createMerchantAuth } from '@commerce/auth'
import { authSchema, createDb, role, store, storeMember } from '@commerce/db'
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
  sendInvite: async () => undefined,
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined } }
}

async function userIdOf(headers: Headers) {
  return (await auth.api.getSession({ headers }))?.user.id as string
}

/** An owner with a store whose system roles are seeded. */
async function storeWithOwner(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId })
    .returning()
  if (!s) throw new Error('seed')
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return { headers, organizationId, storeId: s.id }
}

/** Signs `email` in and joins them to the store as Staff, active in it. */
async function staffIn(shop: Awaited<ReturnType<typeof storeWithOwner>>, email: string) {
  const headers = await signIn(email)
  const userId = await userIdOf(headers)
  await owner.insert(authSchema.member).values({
    id: `m-${userId}-${shop.organizationId}`,
    organizationId: shop.organizationId,
    userId,
    role: 'member',
  })
  const [staff] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, shop.storeId), eq(role.slug, 'staff')))
  await owner
    .insert(storeMember)
    .values({ storeId: shop.storeId, userId, roleId: staff?.id as string })
  await auth.api.setActiveOrganization({
    headers,
    body: { organizationId: shop.organizationId },
  })
  return { headers, userId }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('account profile', () => {
  it('saves the name and phone as E.164 on the caller only', async () => {
    const a = await signIn('asha@example.com')
    const b = await signIn('bilal@example.com')
    const saved = await call(
      appRouter.account.updateProfile,
      { name: '  Asha Rao ', phone: '98046 82471' },
      { context: ctx(a) },
    )
    expect(saved).toMatchObject({ name: 'Asha Rao', phone: '+919804682471' })

    const other = await call(appRouter.account.profile, {}, { context: ctx(b) })
    expect(other).toMatchObject({ email: 'bilal@example.com', phone: null })
  })

  it('refuses a number that is not a mobile, and an empty name', async () => {
    const a = await signIn('asha@example.com')
    await expect(
      call(appRouter.account.updateProfile, { name: 'Asha', phone: '12345' }, { context: ctx(a) }),
    ).rejects.toThrow()
    await expect(
      call(appRouter.account.updateProfile, { name: ' ', phone: '' }, { context: ctx(a) }),
    ).rejects.toThrow()
  })

  it("refuses a photo URL sent straight to Better Auth's update-user", async () => {
    const a = await signIn('asha@example.com')
    const before = await call(appRouter.account.profile, {}, { context: ctx(a) })
    await auth.api
      .updateUser({
        headers: a,
        body: { name: 'Someone else', image: 'https://tracker.example/pixel.gif' },
      })
      .catch(() => undefined)
    const after = await call(appRouter.account.profile, {}, { context: ctx(a) })
    expect(after).toMatchObject({ name: before.name, image: null })
  })

  it('needs a signed-in member', async () => {
    await expect(
      call(appRouter.account.profile, {}, { context: ctx(new Headers()) }),
    ).rejects.toThrow('Sign in required')
  })
})

describe('account stores', () => {
  it('lists only the stores the member belongs to, with the owner flagged', async () => {
    const shopA = await storeWithOwner('boss@example.com', 'acct-a')
    const shopB = await storeWithOwner('other@example.com', 'acct-b')
    const helper = await staffIn(shopA, 'helper@example.com')

    const mine = await call(appRouter.account.stores, {}, { context: ctx(shopA.headers) })
    expect(mine.map((s) => [s.organizationId, s.isOwner, s.active])).toEqual([
      [shopA.organizationId, true, true],
    ])

    const theirs = await call(appRouter.account.stores, {}, { context: ctx(helper.headers) })
    expect(theirs).toHaveLength(1)
    expect(theirs[0]).toMatchObject({
      organizationId: shopA.organizationId,
      isOwner: false,
      roleName: 'Staff',
    })
    expect(theirs.some((s) => s.organizationId === shopB.organizationId)).toBe(false)
  })

  it('lets staff leave: the membership and staff row go, and the store stops answering', async () => {
    const shop = await storeWithOwner('boss@example.com', 'acct-c')
    const helper = await staffIn(shop, 'helper@example.com')

    const left = await call(
      appRouter.account.leaveStore,
      { organizationId: shop.organizationId },
      { context: ctx(helper.headers) },
    )
    expect(left.wasActive).toBe(true)

    const rows = await owner
      .select()
      .from(storeMember)
      .where(and(eq(storeMember.storeId, shop.storeId), eq(storeMember.userId, helper.userId)))
    expect(rows).toHaveLength(0)
    expect(await call(appRouter.account.stores, {}, { context: ctx(helper.headers) })).toEqual([])
    await expect(call(appRouter.staff.me, {}, { context: ctx(helper.headers) })).rejects.toThrow()
  })

  it('never lets the owner leave, and refuses a store the member is not in', async () => {
    const shopA = await storeWithOwner('boss@example.com', 'acct-d')
    const shopB = await storeWithOwner('other@example.com', 'acct-e')

    await expect(
      call(
        appRouter.account.leaveStore,
        { organizationId: shopA.organizationId },
        { context: ctx(shopA.headers) },
      ),
    ).rejects.toThrow('You own this store')
    await expect(
      call(
        appRouter.account.leaveStore,
        { organizationId: shopB.organizationId },
        { context: ctx(shopA.headers) },
      ),
    ).rejects.toThrow('not a member')

    const owners = await owner
      .select()
      .from(authSchema.member)
      .where(eq(authSchema.member.organizationId, shopB.organizationId))
    expect(owners).toHaveLength(1)
  })
})
