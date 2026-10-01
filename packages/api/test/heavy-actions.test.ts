import { createMerchantAuth } from '@commerce/auth'
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  type RateLimitStore,
  rateLimitKey,
} from '@commerce/core'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { HEAVY_ACTION_RULES } from '../src/procedures'
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

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const otp = sent.at(-1)?.otp as string
  const res = await auth.api.signInEmailOTP({ body: { email, otp }, asResponse: true })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, storeId: s.id }
}

let limiter: RateLimitStore
const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
  rateLimit: limiter,
})

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  limiter = createMemoryRateLimitStore()
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** Spends a store's whole budget for one kind of action without making the calls. */
async function exhaust(storeId: string, action: keyof typeof HEAVY_ACTION_RULES) {
  const rule = HEAVY_ACTION_RULES[action]
  for (let i = 0; i < rule.limit; i++) {
    await checkRateLimit(limiter, rateLimitKey(`heavy:${action}`, storeId), rule)
  }
}

describe('heavy admin actions are rate-limited per store', () => {
  it('a store over its export budget is refused; another store is not', async () => {
    const a = await merchant('a@example.com', 'heavy-a')
    const b = await merchant('b@example.com', 'heavy-b')
    const filters = {}

    // Under budget: works.
    await expect(
      call(appRouter.products.exportRows, filters, { context: ctx(a.headers) }),
    ).resolves.toBeDefined()

    await exhaust(a.storeId, 'export')
    await expect(
      call(appRouter.products.exportRows, filters, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    // The same bucket covers every export, not just the button that was pressed.
    await expect(
      call(
        appRouter.inventory.exportRows,
        { locationId: '0190b6c0-0000-7000-8000-000000000001' },
        { context: ctx(a.headers) },
      ),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })

    // Store B's admin is unaffected by A's load.
    await expect(
      call(appRouter.products.exportRows, filters, { context: ctx(b.headers) }),
    ).resolves.toBeDefined()
  })

  it('bulk edits and imports have their own budgets', async () => {
    const a = await merchant('c@example.com', 'heavy-c')
    await exhaust(a.storeId, 'import')
    await expect(
      call(appRouter.products.previewImport, { csv: 'Handle\n' }, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    // Exports still work: a different bucket.
    await expect(
      call(appRouter.products.exportRows, {}, { context: ctx(a.headers) }),
    ).resolves.toBeDefined()

    await exhaust(a.storeId, 'bulk')
    await expect(
      call(
        appRouter.products.bulk,
        { ids: ['0190b6c0-0000-7000-8000-000000000000'], action: { kind: 'delete' } },
        { context: ctx(a.headers) },
      ),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
  })
})
