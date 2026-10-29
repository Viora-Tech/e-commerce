import { createMerchantAuth } from '@commerce/auth'
import type { ApiPrincipal } from '@commerce/core'
import { authSchema, createDb, platformAccessLog, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import {
  apiTokenRefusal,
  classifyAction,
  exclusionReason,
  routerProcedures,
} from '../src/mcp/action-catalogue'
import { appRouter } from '../src/routers/_app'

/**
 * The platform console's guard (`platformProcedure`): only a staff email, signed in with a
 * passkey, on a host that passes the owner connection, gets in. Everyone else gets NOT_FOUND,
 * never FORBIDDEN, so the console cannot be discovered. Never reachable over MCP or tokens.
 */

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

const STAFF = 'staff@koomerce.app'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function signIn(email: string, method: 'passkey' | 'email_otp' = 'passkey') {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('no session')
  // What the auth hook writes for a passkey sign-in (`recordMemberSignIn`).
  await owner.insert(authSchema.memberSignIn).values({
    id: `si-${session.session.id}`,
    userId: session.user.id,
    sessionId: session.session.id,
    method,
  })
  return headers
}

function ctx(headers: Headers, extra: Partial<ApiContext> = {}): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    platformDb: owner,
    platformStaff: [STAFF],
    // Never reach GitHub from a test: the open-reports count reads as "not available".
    githubFetch: (async () => new Response('{}', { status: 500 })) as typeof fetch,
    ...extra,
  }
}

/** Every platform procedure with a valid input, so the guard is what decides. */
const CALLS = [
  (c: ApiContext) => call(appRouter.platform.whoami, undefined, { context: c }),
  (c: ApiContext) => call(appRouter.platform.overview, undefined, { context: c }),
  (c: ApiContext) => call(appRouter.platform.stores.list, {}, { context: c }),
  (c: ApiContext) =>
    call(
      appRouter.platform.stores.get,
      { id: '019a0000-0000-7000-8000-000000000001' },
      { context: c },
    ),
  (c: ApiContext) => call(appRouter.platform.users.list, {}, { context: c }),
  (c: ApiContext) => call(appRouter.platform.audit.list, {}, { context: c }),
]

async function expectAllNotFound(c: ApiContext) {
  for (const run of CALLS) {
    await expect(run(c)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  }
  expect(await owner.select().from(platformAccessLog)).toEqual([])
}

describe('platform console guard', () => {
  it('answers NOT_FOUND to a signed-out caller', async () => {
    await expectAllNotFound(ctx(new Headers()))
  })

  it('answers NOT_FOUND to a merchant who is not on the staff list', async () => {
    await expectAllNotFound(ctx(await signIn('owner@shop.in')))
  })

  it('answers NOT_FOUND to staff whose session was not opened with a passkey', async () => {
    await expectAllNotFound(ctx(await signIn(STAFF, 'email_otp')))
  })

  it('answers NOT_FOUND when the host gives no owner connection (bearer API, MCP)', async () => {
    await expectAllNotFound(ctx(await signIn(STAFF), { platformDb: undefined }))
  })

  it('answers NOT_FOUND to an access token, even one standing in for staff', async () => {
    const headers = await signIn(STAFF)
    await expectAllNotFound(ctx(headers, { apiPrincipal: { email: STAFF } as ApiPrincipal }))
  })

  it('answers NOT_FOUND when the staff list is empty', async () => {
    await expectAllNotFound(ctx(await signIn(STAFF), { platformStaff: [] }))
  })

  it('lets staff in with a passkey session and logs every read', async () => {
    const headers = await signIn(STAFF)
    const [s] = await owner.insert(store).values({ slug: 'asha', name: 'Asha' }).returning()
    const c = ctx(headers)

    expect(await call(appRouter.platform.whoami, undefined, { context: c })).toMatchObject({
      email: STAFF,
    })
    const overview = await call(appRouter.platform.overview, undefined, { context: c })
    expect(overview.stores.total).toBe(1)
    expect(overview.openReports).toBeNull()
    expect(overview.queues).toBeNull()
    const stores = await call(appRouter.platform.stores.list, { search: 'asha' }, { context: c })
    expect(stores.rows.map((r) => r.id)).toEqual([s?.id])
    const detail = await call(
      appRouter.platform.stores.get,
      { id: s?.id as string },
      { context: c },
    )
    expect(detail.store.slug).toBe('asha')
    await expect(
      call(
        appRouter.platform.stores.get,
        { id: '019a0000-0000-7000-8000-000000000001' },
        { context: c },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const log = await owner.select().from(platformAccessLog)
    expect(log.map((r) => r.action).sort()).toEqual([
      'overview.read',
      'stores.detail',
      'stores.list',
    ])
    expect(log.find((r) => r.action === 'stores.detail')).toMatchObject({
      actorEmail: STAFF,
      storeId: s?.id,
    })
    expect(log.find((r) => r.action === 'stores.list')?.target).toBe('search=asha')
  })

  it('passes queue counts through when the host has them', async () => {
    const c = ctx(await signIn(STAFF), {
      queueHealth: async () => [
        { name: 'q', waiting: 2, active: 1, delayed: 0, failed: 3, oldestWaitingAt: null },
      ],
    })
    const overview = await call(appRouter.platform.overview, undefined, { context: c })
    expect(overview.queues).toEqual([
      { name: 'q', waiting: 2, active: 1, delayed: 0, failed: 3, oldestWaitingAt: null },
    ])
  })
})

describe('platform console and MCP', () => {
  it('no platform procedure is an MCP action', () => {
    expect(exclusionReason('platform.overview')).toMatch(/staff console/)
    expect(exclusionReason('platform.reports.list')).toMatch(/staff console/)
    const paths = routerProcedures(appRouter.platform, ['platform']).map((p) => p.path)
    expect(paths.length).toBeGreaterThan(4)
    for (const path of paths) {
      expect(classifyAction(path)).toBeNull()
      expect(apiTokenRefusal(path)).not.toBeNull()
    }
  })
})
