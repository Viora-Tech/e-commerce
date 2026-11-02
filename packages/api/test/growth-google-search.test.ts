/** SOURCE OF TRUTH: Growth's Google Search card read (#1022): marketing.searchSummary */
import { createMerchantAuth } from '@commerce/auth'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string): Promise<ApiContext> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  await owner.insert(store).values({ slug, name: slug, organizationId: org?.id as string })
  return { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('marketing.searchSummary', () => {
  it('tells Growth to install the app when Search Console is not set up', async () => {
    const ctx = await merchant('gs-a@example.com', 'gs-a')
    const summary = await call(appRouter.marketing.searchSummary, undefined, { context: ctx })
    expect(summary).toEqual({ state: 'not-installed' })
  })
})
