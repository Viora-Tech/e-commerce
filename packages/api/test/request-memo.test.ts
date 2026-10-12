import { createMerchantAuth } from '@commerce/auth'
import { authSchema, createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiContext } from '../src/context'
import { createRequestMemo, remember } from '../src/procedures/request-memo'
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

/** Sign in by OTP, create an org with a store, set it active. Returns request headers. */
async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const otp = sent.at(-1)?.otp as string
  const res = await auth.api.signInEmailOTP({ body: { email, otp }, asResponse: true })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  await owner.insert(store).values({ slug, name: slug, organizationId })
  const [me] = await owner
    .select({ id: authSchema.user.id })
    .from(authSchema.user)
    .where(eq(authSchema.user.email, email))
  return { headers, organizationId, userId: me?.id as string }
}

function sqlText(query: unknown): string {
  try {
    return JSON.stringify(query) ?? ''
  } catch {
    return ''
  }
}

/** Counts the session reads and membership lookups the router makes. */
function countingContext(headers: Headers, memo?: ApiContext['memo']) {
  const counts = { sessions: 0, memberships: 0 }
  const countedAuth = {
    ...auth,
    api: {
      ...auth.api,
      getSession: ((...args: Parameters<typeof auth.api.getSession>) => {
        counts.sessions++
        return auth.api.getSession(...args)
      }) as typeof auth.api.getSession,
    },
  }
  const execute = app.execute.bind(app)
  const countedDb = Object.create(app) as typeof app
  countedDb.execute = ((query: Parameters<typeof app.execute>[0]) => {
    if (sqlText(query).includes('resolve_store_for_organization')) counts.memberships++
    return execute(query)
  }) as typeof app.execute
  const context: ApiContext = {
    db: countedDb,
    auth: countedAuth,
    headers,
    notifications: { add: async () => undefined },
    memo,
  }
  return { context, counts }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('remember', () => {
  it('loads once per key and shares the in-flight promise', async () => {
    const memo = createRequestMemo()
    const load = vi.fn(async () => 42)
    const [a, b] = await Promise.all([remember(memo, 'k', load), remember(memo, 'k', load)])
    expect([a, b]).toEqual([42, 42])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not keep a failure, so a later call tries again', async () => {
    const memo = createRequestMemo()
    const failing = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(remember(memo, 'k', failing)).rejects.toThrow('boom')
    await expect(remember(memo, 'k', async () => 'ok')).resolves.toBe('ok')
  })

  it('calls through every time without a memo (tests, scripts)', async () => {
    const load = vi.fn(async () => 1)
    await remember(undefined, 'k', load)
    await remember(undefined, 'k', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('one request, many store calls', () => {
  it('reads the session and the membership once for parallel calls', async () => {
    const a = await merchant('memo-a@example.com', 'memo-a')
    const { context, counts } = countingContext(a.headers, createRequestMemo())
    await Promise.all([
      call(appRouter.staff.me, {}, { context }),
      call(appRouter.products.list, { page: 1, perPage: 5 }, { context }),
      call(appRouter.orders.list, { page: 1, perPage: 5 }, { context }),
    ])
    expect(counts.sessions).toBe(1)
    expect(counts.memberships).toBe(1)
  })

  it('without a memo, each call looks them up itself', async () => {
    const a = await merchant('memo-b@example.com', 'memo-b')
    const { context, counts } = countingContext(a.headers)
    await call(appRouter.staff.me, {}, { context })
    await call(appRouter.products.list, { page: 1, perPage: 5 }, { context })
    expect(counts.sessions).toBe(2)
    expect(counts.memberships).toBe(2)
  })

  it('never carries membership into the next request', async () => {
    const a = await merchant('memo-c@example.com', 'memo-c')
    const first = countingContext(a.headers, createRequestMemo())
    await expect(call(appRouter.staff.me, {}, { context: first.context })).resolves.toBeTruthy()

    // Removed from the store between two page loads: the next request is refused.
    await owner
      .delete(authSchema.member)
      .where(
        and(
          eq(authSchema.member.organizationId, a.organizationId),
          eq(authSchema.member.userId, a.userId),
        ),
      )
    const second = countingContext(a.headers, createRequestMemo())
    await expect(call(appRouter.staff.me, {}, { context: second.context })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      data: { reason: 'no_store' },
    })
  })

  it('refuses a store the caller is not a member of', async () => {
    const a = await merchant('memo-d@example.com', 'memo-d')
    const b = await merchant('memo-e@example.com', 'memo-e')
    // A's session pointed at B's organization (a stale or forged active id).
    await owner
      .update(authSchema.session)
      .set({ activeOrganizationId: b.organizationId })
      .where(eq(authSchema.session.userId, a.userId))
    const { context } = countingContext(a.headers, createRequestMemo())
    await expect(
      call(appRouter.products.list, { page: 1, perPage: 5 }, { context }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', data: { reason: 'no_store' } })
  })
})
