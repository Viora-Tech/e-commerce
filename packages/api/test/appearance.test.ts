import { createMerchantAuth } from '@commerce/auth'
import { createDb, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
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

/** Signs in, creates the org and its store, sets it active. */
async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner.insert(store).values({ slug, name: slug, organizationId }).returning()
  if (!s) throw new Error('seed')
  return { headers, organizationId, storeId: s.id }
}

/** A second person in the owner's store. */
async function member(email: string, organizationId: string) {
  const headers = await signIn(email)
  const session = await auth.api.getSession({ headers })
  await auth.api.addMember({
    body: { userId: session?.user.id as string, role: 'member', organizationId },
  })
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  return headers
}

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined } }
}

const get = (h: Headers) => call(appRouter.appearance.get, undefined, { context: ctx(h) })

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('admin accent preference', () => {
  it('starts on the default', async () => {
    const a = await merchant('owner@example.com', 'accent-a')
    expect(await get(a.headers)).toMatchObject({
      mine: null,
      storeDefault: null,
      effective: null,
      storeId: a.storeId,
      canSetStoreDefault: true,
    })
  })

  it("uses the owner's store default for members until they pick their own", async () => {
    const a = await merchant('owner@example.com', 'accent-a')
    await call(
      appRouter.appearance.setStoreDefault,
      { accent: '#2563EB' },
      { context: ctx(a.headers) },
    )
    const helper = await member('helper@example.com', a.organizationId)

    expect(await get(helper)).toMatchObject({
      mine: null,
      storeDefault: '#2563eb',
      effective: '#2563eb',
      canSetStoreDefault: false,
    })

    const mine = await call(
      appRouter.appearance.setMine,
      { accent: 'e11d48' },
      { context: ctx(helper) },
    )
    expect(mine).toMatchObject({ mine: '#e11d48', effective: '#e11d48' })
    // The owner still sees the store default; a member's pick is theirs alone.
    expect((await get(a.headers)).effective).toBe('#2563eb')

    // Picking Ocean Green explicitly beats a non-default store default.
    await call(appRouter.appearance.setMine, { accent: '#4ea674' }, { context: ctx(helper) })
    expect((await get(helper)).effective).toBe('#4ea674')

    // Clearing the pick falls back to the store default again.
    await call(appRouter.appearance.setMine, { accent: null }, { context: ctx(helper) })
    expect((await get(helper)).effective).toBe('#2563eb')
  })

  it('refuses the store default from anyone but the owner', async () => {
    const a = await merchant('owner@example.com', 'accent-a')
    await get(a.headers) // seeds the roles
    const helper = await member('helper@example.com', a.organizationId)
    await expect(
      call(appRouter.appearance.setStoreDefault, { accent: '#2563eb' }, { context: ctx(helper) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const [s] = await owner.select().from(store).where(eq(store.id, a.storeId))
    expect(s?.adminAccent).toBeNull()
  })

  it('keeps stores apart', async () => {
    const a = await merchant('a@example.com', 'accent-a')
    const b = await merchant('b@example.com', 'accent-b')
    await call(
      appRouter.appearance.setStoreDefault,
      { accent: '#7c3aed' },
      { context: ctx(a.headers) },
    )
    await call(appRouter.appearance.setMine, { accent: '#ea580c' }, { context: ctx(a.headers) })

    expect(await get(b.headers)).toMatchObject({ mine: null, storeDefault: null, effective: null })
    const [sb] = await owner.select().from(store).where(eq(store.id, b.storeId))
    expect(sb?.adminAccent).toBeNull()
    const members = await owner.select().from(storeMember).where(eq(storeMember.storeId, b.storeId))
    expect(members.every((m) => m.adminAccent === null)).toBe(true)
  })

  it('rejects an invalid hex and ignores a bad stored value', async () => {
    const a = await merchant('owner@example.com', 'accent-a')
    for (const accent of ['red', '#12345', '#fff;}body{display:none']) {
      await expect(
        call(appRouter.appearance.setMine, { accent }, { context: ctx(a.headers) }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    await owner.update(store).set({ adminAccent: 'url(evil)' }).where(eq(store.id, a.storeId))
    expect((await get(a.headers)).storeDefault).toBeNull()
  })
})
