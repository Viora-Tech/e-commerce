import { createMerchantAuth } from '@commerce/auth'
import { createDb, role, store, storeDomain, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/**
 * Store-facing links (admin "View store", theme previews, marketing links) go to the store's
 * own live primary domain. STOREFRONT_URL belongs to no store on a multi-tenant server, so it
 * is only the fallback for a store without one.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const PLATFORM = 'https://shop.platform.test'

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

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined } }
}

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner.insert(store).values({ slug, name: slug, organizationId }).returning()
  if (!s) throw new Error('seed')
  return { headers, organizationId, storeId: s.id }
}

/** A member on the system `staff` role, which has no `settings.read`. */
async function staff(storeId: string, organizationId: string, ownerHeaders: Headers) {
  await call(appRouter.staff.me, {}, { context: ctx(ownerHeaders) }) // seeds the roles
  const headers = await signIn('helper@example.com')
  const session = await auth.api.getSession({ headers })
  const userId = session?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, storeId), eq(role.slug, 'staff')))
  if (!r) throw new Error('no staff role')
  const [m] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  if (m) await owner.update(storeMember).set({ roleId: r.id }).where(eq(storeMember.id, m.id))
  else await owner.insert(storeMember).values({ storeId, userId, roleId: r.id })
  return headers
}

const before = process.env.STOREFRONT_URL

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  process.env.STOREFRONT_URL = PLATFORM
})
afterEach(() => {
  if (before === undefined) delete process.env.STOREFRONT_URL
  else process.env.STOREFRONT_URL = before
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store links use the primary domain', () => {
  it('a store with a live primary domain gets links on it, staff included', async () => {
    const a = await merchant('owner@example.com', 'links-a')
    await owner.insert(storeDomain).values([
      { storeId: a.storeId, hostname: 'links-a.platform.test', status: 'active' },
      { storeId: a.storeId, hostname: 'kuldeepsaini.com', isPrimary: true, status: 'active' },
    ])

    const origin = () => call(appRouter.store.origin, undefined, { context: ctx(a.headers) })
    expect(await origin()).toBe('https://kuldeepsaini.com')

    // Marketing links (shop, click, unsubscribe) start from the same origin.
    const setup = await call(appRouter.marketing.setup, undefined, { context: ctx(a.headers) })
    expect(setup.storefrontUrl).toBe('https://kuldeepsaini.com')

    // Staff without settings.read (so no store.current) still get working links.
    const helper = await staff(a.storeId, a.organizationId, a.headers)
    await expect(
      call(appRouter.store.current, undefined, { context: ctx(helper) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await call(appRouter.store.origin, undefined, { context: ctx(helper) })).toBe(
      'https://kuldeepsaini.com',
    )
  })

  it('falls back to STOREFRONT_URL until the primary domain is live', async () => {
    const a = await merchant('owner@example.com', 'links-a')
    const [d] = await owner
      .insert(storeDomain)
      .values({ storeId: a.storeId, hostname: 'brand.test', isPrimary: true, status: 'pending' })
      .returning()
    const origin = () => call(appRouter.store.origin, undefined, { context: ctx(a.headers) })
    expect(await origin()).toBe(PLATFORM)
    await owner
      .update(storeDomain)
      .set({ status: 'active' })
      .where(eq(storeDomain.id, d?.id as string))
    expect(await origin()).toBe('https://brand.test')
  })
})
