import { createMerchantAuth } from '@commerce/auth'
import { createDb, role, store, storeMember } from '@commerce/db'
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

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

/** A store whose `apps` already holds an installed app and the core tax switches. */
async function merchantWithStore(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const apps = {
    installed: ['reviews'],
    settings: {
      core: { tax: { pricesIncludeGst: false, composition: true } },
      reviews: { autoPublish: true },
    },
  }
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string, apps })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, organizationId: org?.id as string, storeId: s.id }
}

const appsOf = async (storeId: string) =>
  (await owner.select({ apps: store.apps }).from(store).where(eq(store.id, storeId)))[0]?.apps

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('themes.setPacks', () => {
  it('turns Zero Drift on and off for one theme, leaving store.apps and other themes alone', async () => {
    const m = await merchantWithStore('packs@example.com', 'packs-a')
    const c = { context: ctx(m.headers) }
    const [live] = await call(appRouter.themes.list, undefined, c)
    if (!live) throw new Error('no live theme')
    const other = await call(appRouter.themes.create, { preset: 'soft' }, c)
    expect(await call(appRouter.themes.packs, { id: live.id }, c)).toEqual([])

    expect(
      await call(appRouter.themes.setPacks, { id: live.id, packs: ['zero-drift'] }, c),
    ).toEqual(['zero-drift'])
    expect(await call(appRouter.themes.packs, { id: live.id }, c)).toEqual(['zero-drift'])
    expect(await call(appRouter.themes.packs, { id: other.id }, c)).toEqual([])
    const listed = await call(appRouter.themes.list, undefined, c)
    expect(listed.find((t) => t.id === live.id)?.packs).toEqual(['zero-drift'])
    expect((await appsOf(m.storeId)) as unknown).toEqual({
      installed: ['reviews'],
      settings: {
        core: { tax: { pricesIncludeGst: false, composition: true } },
        reviews: { autoPublish: true },
      },
    })

    expect(await call(appRouter.themes.setPacks, { id: live.id, packs: [] }, c)).toEqual([])
    expect(await call(appRouter.themes.packs, { id: live.id }, c)).toEqual([])
  })

  it('a theme without its own list follows the store-level flag (Waimers before the move)', async () => {
    const m = await merchantWithStore('packs-old@example.com', 'packs-old')
    await owner
      .update(store)
      .set({ apps: { installed: [], settings: { core: { themePacks: ['zero-drift'] } } } })
      .where(eq(store.id, m.storeId))
    const c = { context: ctx(m.headers) }
    const [live] = await call(appRouter.themes.list, undefined, c)
    if (!live) throw new Error('no live theme')
    expect(live.packs).toEqual(['zero-drift'])
    expect(await call(appRouter.themes.packs, { id: live.id }, c)).toEqual(['zero-drift'])
    const fresh = await call(appRouter.themes.createBlank, {}, c)
    expect(fresh.packs).toEqual([])
  })

  it('refuses a pack it does not know', async () => {
    const m = await merchantWithStore('packs-b@example.com', 'packs-b')
    const c = { context: ctx(m.headers) }
    const [live] = await call(appRouter.themes.list, undefined, c)
    await expect(
      call(appRouter.themes.setPacks, { id: live?.id, packs: ['nope'] } as never, c),
    ).rejects.toThrow()
  })

  it('is for owners and administrators: staff cannot change it', async () => {
    const boss = await merchantWithStore('boss-packs@example.com', 'packs-c')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })

    const helperHeaders = await signIn('helper-packs@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    const [staff] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
    if (!staff) throw new Error('no staff role')
    await owner
      .insert(storeMember)
      .values({ storeId: boss.storeId, userId: helperId, roleId: staff.id })

    const [live] = await call(appRouter.themes.list, undefined, { context: ctx(boss.headers) })
    if (!live) throw new Error('no live theme')
    await expect(
      call(
        appRouter.themes.setPacks,
        { id: live.id, packs: ['zero-drift'] },
        { context: ctx(helperHeaders) },
      ),
    ).rejects.toThrow()
    expect(
      await call(appRouter.themes.packs, { id: live.id }, { context: ctx(boss.headers) }),
    ).toEqual([])
  })
})
