/**
 * Step-up guard (A5, task 3). When enforcement is on, a sensitive action from a browser session
 * is refused with STEP_UP_REQUIRED unless that session re-verified within the window. Reads,
 * ordinary writes, a fresh session, and enforcement-off all pass straight through.
 */
import { createMerchantAuth, markReauthenticated } from '@commerce/auth'
import { authSchema, collection, createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call, createRouterClient } from '@orpc/server'
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

/** Signs in, creates the org, sets it active, seeds the system roles, and returns the owner's bits. */
async function ownerMerchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const session = await auth.api.getSession({ headers })
  const userId = session?.user.id as string
  const sessionId = session?.session.id as string
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  // Seed the system roles with one owner call.
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return { headers, userId, sessionId, storeId: s?.id as string }
}

function ctx(headers: Headers, extra?: Partial<ApiContext>): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    ...extra,
  }
}

/** A client that traverses the router by key, so the middleware sees the real dotted `path`. */
function client(headers: Headers, extra?: Partial<ApiContext>) {
  return createRouterClient(appRouter, { context: ctx(headers, extra) })
}

/** Push this session's last step-up into the past so the guard sees it as stale. */
async function ageSession(sessionId: string, minutesAgo: number) {
  await owner
    .update(authSchema.session)
    .set({ reauthenticatedAt: new Date(Date.now() - minutesAgo * 60_000) })
    .where(eq(authSchema.session.id, sessionId))
}

async function makeCollection(headers: Headers, title: string): Promise<string> {
  const made = await call(
    appRouter.collections.create,
    { title, kind: 'manual' },
    { context: ctx(headers) },
  )
  return made.id
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('step-up guard', () => {
  it('refuses a sensitive action from a stale session when enforcement is on', async () => {
    const o = await ownerMerchant('owner@example.com', 'guard-a')
    const id = await makeCollection(o.headers, 'Mice')
    await ageSession(o.sessionId, 11)

    await expect(
      client(o.headers, { stepUpEnforce: true }).collections.delete({ id }),
    ).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' })

    // The guard threw before the handler ran: the collection is still there.
    const [row] = await owner.select().from(collection).where(eq(collection.id, id))
    expect(row).toBeTruthy()
  })

  it('lets the same sensitive action through once the session steps up', async () => {
    const o = await ownerMerchant('owner@example.com', 'guard-b')
    const id = await makeCollection(o.headers, 'Mice')
    await ageSession(o.sessionId, 11)
    // Re-verify (what reauth.verify does on success).
    await markReauthenticated(app, { sessionId: o.sessionId, userId: o.userId })

    await client(o.headers, { stepUpEnforce: true }).collections.delete({ id })
    const [row] = await owner.select().from(collection).where(eq(collection.id, id))
    expect(row).toBeFalsy()
  })

  it('never gates a sensitive action when enforcement is off (the default)', async () => {
    const o = await ownerMerchant('owner@example.com', 'guard-c')
    const id = await makeCollection(o.headers, 'Mice')
    await ageSession(o.sessionId, 11)

    await client(o.headers).collections.delete({ id })
    const [row] = await owner.select().from(collection).where(eq(collection.id, id))
    expect(row).toBeFalsy()
  })

  it('never gates reads or ordinary writes, even stale with enforcement on', async () => {
    const o = await ownerMerchant('owner@example.com', 'guard-d')
    await ageSession(o.sessionId, 11)
    const on = client(o.headers, { stepUpEnforce: true })

    // A read and a non-sensitive write both run despite the stale session, path and all.
    expect(await on.collections.list()).toHaveLength(0)
    const made = await on.collections.create({ title: 'Pads', kind: 'manual' })
    expect(made.id).toBeTruthy()
  })
})
