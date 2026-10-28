import { createMerchantAuth } from '@commerce/auth'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call, ORPCError } from '@orpc/server'
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

async function merchant(email: string, slug: string) {
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

/** The oRPC code a call was refused with. */
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (err) {
    if (err instanceof ORPCError) return `${err.code}: ${err.message}`
    throw err
  }
  return 'accepted'
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('markets router', () => {
  it('lists the primary market first and adds, changes and removes markets', async () => {
    const context = await merchant('a@example.com', 'store-a')
    const [india] = await call(appRouter.markets.list, undefined, { context })
    expect(india).toMatchObject({ name: 'India', isPrimary: true, countries: ['IN'] })

    const gulf = await call(
      appRouter.markets.create,
      { name: 'Gulf', countries: ['AE'], currency: 'AED', subfolder: 'ae', locales: ['ar'] },
      { context },
    )
    const changed = await call(
      appRouter.markets.update,
      { id: gulf.id, countries: ['AE', 'QA'], priceAdjustmentBp: 500 },
      { context },
    )
    expect(changed).toMatchObject({ countries: ['AE', 'QA'], priceAdjustmentBp: 500 })
    expect(
      await call(appRouter.markets.setEnabled, { id: gulf.id, enabled: false }, { context }),
    ).toMatchObject({ enabled: false })
    expect(await call(appRouter.markets.get, { id: gulf.id }, { context })).toMatchObject({
      enabled: false,
    })
    expect(await call(appRouter.markets.delete, { id: gulf.id }, { context })).toEqual({
      outcome: 'deleted',
    })
    expect(await call(appRouter.markets.list, undefined, { context })).toHaveLength(1)
  })

  it('answers a refused change with its status and words', async () => {
    const context = await merchant('b@example.com', 'store-b')
    const [india] = await call(appRouter.markets.list, undefined, { context })
    await call(
      appRouter.markets.create,
      { name: 'Gulf', countries: ['AE'], currency: 'AED', subfolder: 'ae' },
      { context },
    )
    expect(
      await refusal(
        call(
          appRouter.markets.create,
          { name: 'UAE', countries: ['AE'], currency: 'AED' },
          { context },
        ),
      ),
    ).toBe('CONFLICT: United Arab Emirates is already in the Gulf market')
    expect(
      await refusal(call(appRouter.markets.delete, { id: india?.id as string }, { context })),
    ).toBe("BAD_REQUEST: India is your primary market: it can't be deleted")
    expect(
      await refusal(
        call(appRouter.markets.get, { id: '0190a0a0-0000-7000-8000-000000000000' }, { context }),
      ),
    ).toBe('NOT_FOUND: Market not found')
  })
})
