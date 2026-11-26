/**
 * Account → Notifications, push devices: the list, Turn off for this device and Remove for any
 * other. Each acts on the caller's own rows only, and a removed device has no row left for the
 * worker to push to.
 */
import { createMerchantAuth } from '@commerce/auth'
import {
  authSchema,
  createDb,
  memberPushSubscription,
  role,
  store,
  storeMember,
} from '@commerce/db'
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

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

/** Saves one push device row straight in the database (keys are opaque here). */
async function device(storeId: string, userId: string, endpoint: string, userAgent: string) {
  const [row] = await owner
    .insert(memberPushSubscription)
    .values({ storeId, userId, endpoint, p256dh: 'enc-p256dh', auth: 'enc-auth', userAgent })
    .returning()
  if (!row) throw new Error('seed')
  return row
}

async function rowsOf(userId: string) {
  return owner
    .select({ id: memberPushSubscription.id })
    .from(memberPushSubscription)
    .where(eq(memberPushSubscription.userId, userId))
}

describe('account push devices', () => {
  it('lists only the caller’s devices, marks this one and never returns endpoints or keys', async () => {
    const shop = await storeWithOwner('boss@example.com', 'push-a')
    const bossId = await userIdOf(shop.headers)
    const helper = await staffIn(shop, 'helper@example.com')
    await device(shop.storeId, bossId, 'https://push.example/laptop', CHROME_WIN)
    await device(shop.storeId, bossId, 'https://push.example/phone', SAFARI_IPHONE)
    await device(shop.storeId, helper.userId, 'https://push.example/helper', CHROME_WIN)

    const list = await call(
      appRouter.account.pushDevices,
      { endpoint: 'https://push.example/laptop' },
      { context: ctx(shop.headers) },
    )
    expect(list).toHaveLength(2)
    const laptop = list.find((d) => d.device.os === 'Windows')
    const phone = list.find((d) => d.device.os === 'iPhone')
    expect(laptop).toMatchObject({ thisDevice: true, device: { browser: 'Chrome' } })
    expect(phone).toMatchObject({ thisDevice: false, device: { kind: 'phone' } })
    expect(JSON.stringify(list)).not.toContain('push.example')
    expect(JSON.stringify(list)).not.toContain('enc-')

    const none = await call(appRouter.account.pushDevices, {}, { context: ctx(shop.headers) })
    expect(none.every((d) => !d.thisDevice)).toBe(true)
  })

  it('Turn off removes this browser’s row only', async () => {
    const shop = await storeWithOwner('boss@example.com', 'push-b')
    const bossId = await userIdOf(shop.headers)
    await device(shop.storeId, bossId, 'https://push.example/laptop', CHROME_WIN)
    await device(shop.storeId, bossId, 'https://push.example/phone', SAFARI_IPHONE)

    const r = await call(
      appRouter.account.removePushDevice,
      { endpoint: 'https://push.example/laptop' },
      { context: ctx(shop.headers) },
    )
    expect(r.devices).toBe(1)
    const left = await owner
      .select({ endpoint: memberPushSubscription.endpoint })
      .from(memberPushSubscription)
      .where(eq(memberPushSubscription.userId, bossId))
    expect(left.map((x) => x.endpoint)).toEqual(['https://push.example/phone'])
  })

  it('Turn off with another member’s endpoint removes nothing', async () => {
    const shop = await storeWithOwner('boss@example.com', 'push-c')
    const helper = await staffIn(shop, 'helper@example.com')
    await device(shop.storeId, helper.userId, 'https://push.example/helper', CHROME_WIN)

    await call(
      appRouter.account.removePushDevice,
      { endpoint: 'https://push.example/helper' },
      { context: ctx(shop.headers) },
    )
    expect(await rowsOf(helper.userId)).toHaveLength(1)
  })

  it('Remove deletes one of the caller’s own devices by id', async () => {
    const shop = await storeWithOwner('boss@example.com', 'push-d')
    const bossId = await userIdOf(shop.headers)
    const phone = await device(shop.storeId, bossId, 'https://push.example/phone', SAFARI_IPHONE)
    await device(shop.storeId, bossId, 'https://push.example/laptop', CHROME_WIN)

    const r = await call(
      appRouter.account.removePushDeviceById,
      { id: phone.id },
      { context: ctx(shop.headers) },
    )
    expect(r.devices).toBe(1)
    const left = await rowsOf(bossId)
    expect(left.map((x) => x.id)).not.toContain(phone.id)
  })

  it('Remove refuses another member’s device and leaves it in place', async () => {
    const shop = await storeWithOwner('boss@example.com', 'push-e')
    const helper = await staffIn(shop, 'helper@example.com')
    const theirs = await device(shop.storeId, helper.userId, 'https://push.example/h', CHROME_WIN)

    await expect(
      call(
        appRouter.account.removePushDeviceById,
        { id: theirs.id },
        { context: ctx(shop.headers) },
      ),
    ).rejects.toThrow('already removed')
    expect(await rowsOf(helper.userId)).toHaveLength(1)
  })

  it('Remove cannot reach a device in another store', async () => {
    const shopA = await storeWithOwner('boss@example.com', 'push-f')
    const shopB = await storeWithOwner('other@example.com', 'push-g')
    const otherId = await userIdOf(shopB.headers)
    const elsewhere = await device(shopB.storeId, otherId, 'https://push.example/b', CHROME_WIN)

    await expect(
      call(
        appRouter.account.removePushDeviceById,
        { id: elsewhere.id },
        { context: ctx(shopA.headers) },
      ),
    ).rejects.toThrow()
    expect(await rowsOf(otherId)).toHaveLength(1)
  })
})
