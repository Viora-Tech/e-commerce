import { createMerchantAuth } from '@commerce/auth'
import { authSchema, createDb, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const codes: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    codes.push(m)
  },
  sendInvite: async () => undefined,
})

const mail: Message[] = []
const channel: NotificationChannel = {
  id: 'platform_email',
  label: 'Email (sent by the platform)',
  requires: 'email',
  async send(message) {
    mail.push(message)
    return { ok: true, providerRef: 'ses-test' }
  },
}

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: codes.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

function ctx(headers: Headers): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    platformEmail: {
      transport: {
        fromEmail: 'no-reply@example.com',
        fromName: 'Koomerce',
        channel: () => channel,
      },
    },
  }
}

async function userIdOf(headers: Headers) {
  return (await auth.api.getSession({ headers }))?.user.id as string
}

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

async function staffIn(shop: Awaited<ReturnType<typeof storeWithOwner>>, email: string) {
  const headers = await signIn(email)
  const userId = await userIdOf(headers)
  await owner.insert(authSchema.member).values({
    id: `m-${userId}`,
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
  await auth.api.setActiveOrganization({ headers, body: { organizationId: shop.organizationId } })
  return { headers, userId }
}

beforeEach(async () => {
  await resetDb(owner)
  codes.length = 0
  mail.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('personal notifications', () => {
  it('saves my own alerts for this store without touching anyone else’s', async () => {
    const shop = await storeWithOwner('boss@example.com', 'alerts-a')
    const helper = await staffIn(shop, 'helper@example.com')

    const mine = await call(appRouter.account.notifications, {}, { context: ctx(helper.headers) })
    expect(mine.prefs.newOrder).toEqual({ email: false, whatsapp: false })
    const boss = await call(appRouter.account.notifications, {}, { context: ctx(shop.headers) })
    expect(boss.prefs.newOrder).toEqual({ email: true, whatsapp: false })

    const on = { email: true, whatsapp: false }
    await call(
      appRouter.account.updateNotifications,
      {
        newOrder: on,
        lowStock: on,
        paymentProblem: on,
        dailySummary: { ...on, hour: 7 },
        appErrors: on,
      },
      { context: ctx(helper.headers) },
    )
    const after = await call(appRouter.account.notifications, {}, { context: ctx(helper.headers) })
    expect(after.prefs.dailySummary).toMatchObject({ email: true, hour: 7 })
    const bossAfter = await call(
      appRouter.account.notifications,
      {},
      { context: ctx(shop.headers) },
    )
    expect(bossAfter.prefs.dailySummary.email).toBe(false)
  })
})

describe('delete my account', () => {
  it('is refused while the member owns a store', async () => {
    const shop = await storeWithOwner('boss@example.com', 'del-a')
    const blocked = await call(appRouter.account.deletion, {}, { context: ctx(shop.headers) })
    expect(blocked.ownedStores).toEqual(['del-a'])
    await expect(
      call(appRouter.account.sendDeletionCode, {}, { context: ctx(shop.headers) }),
    ).rejects.toThrow('You own del-a')
  })

  it('needs my email typed and the emailed code, then removes me everywhere', async () => {
    const shop = await storeWithOwner('boss@example.com', 'del-b')
    const helper = await staffIn(shop, 'helper@example.com')

    await call(appRouter.account.sendDeletionCode, {}, { context: ctx(helper.headers) })
    expect(mail.at(-1)).toMatchObject({
      to: { email: 'helper@example.com' },
      template: 'account_deletion_code',
    })
    const code = mail.at(-1)?.data.code as string

    await expect(
      call(
        appRouter.account.deleteAccount,
        { email: 'someone@example.com', otp: code },
        { context: ctx(helper.headers) },
      ),
    ).rejects.toThrow('Type your sign-in email')
    await expect(
      call(
        appRouter.account.deleteAccount,
        { email: 'helper@example.com', otp: code === '000000' ? '111111' : '000000' },
        { context: ctx(helper.headers) },
      ),
    ).rejects.toThrow()

    await call(
      appRouter.account.deleteAccount,
      { email: 'Helper@Example.com', otp: code },
      { context: ctx(helper.headers) },
    )
    expect(
      await owner.select().from(authSchema.user).where(eq(authSchema.user.id, helper.userId)),
    ).toEqual([])
    expect(
      await owner.select().from(storeMember).where(eq(storeMember.userId, helper.userId)),
    ).toEqual([])
    expect(
      await owner
        .select()
        .from(authSchema.session)
        .where(eq(authSchema.session.userId, helper.userId)),
    ).toEqual([])
    // The store and its owner are untouched.
    expect(await call(appRouter.account.stores, {}, { context: ctx(shop.headers) })).toHaveLength(1)
  })

  it("a code for one member never deletes another's account", async () => {
    const shop = await storeWithOwner('boss@example.com', 'del-c')
    const a = await staffIn(shop, 'a@example.com')
    const b = await staffIn(shop, 'b@example.com')
    await call(appRouter.account.sendDeletionCode, {}, { context: ctx(a.headers) })
    const codeForA = mail.at(-1)?.data.code as string
    await expect(
      call(
        appRouter.account.deleteAccount,
        { email: 'b@example.com', otp: codeForA },
        { context: ctx(b.headers) },
      ),
    ).rejects.toThrow()
    expect(
      await owner.select().from(authSchema.user).where(eq(authSchema.user.id, b.userId)),
    ).toHaveLength(1)
  })
})
