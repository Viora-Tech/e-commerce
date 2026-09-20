import { createMerchantAuth } from '@commerce/auth'
import { createDb, product, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call, type ORPCError } from '@orpc/server'
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

/** Sign in by OTP, create an org, set it active. Returns request headers. */
async function merchant(email: string, orgSlug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const otp = sent.at(-1)?.otp as string
  const res = await auth.api.signInEmailOTP({ body: { email, otp }, asResponse: true })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: orgSlug, slug: orgSlug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  // setActiveOrganization may refresh the cookie
  return { headers, organizationId: org?.id as string }
}

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store scope', () => {
  it('a member lists and updates only their own store products', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')
    const [sa] = await owner
      .insert(store)
      .values({ slug: 'store-a', name: 'A', organizationId: a.organizationId })
      .returning()
    const [sb] = await owner
      .insert(store)
      .values({ slug: 'store-b', name: 'B', organizationId: b.organizationId })
      .returning()
    if (!sa || !sb) throw new Error('seed')
    const [pa] = await owner
      .insert(product)
      .values({ storeId: sa.id, handle: 'pa', title: 'A product', status: 'active' })
      .returning()
    await owner.insert(product).values({ storeId: sb.id, handle: 'pb', title: 'B product' })
    if (!pa) throw new Error('seed')

    const listed = await call(
      appRouter.products.list,
      { page: 1, perPage: 10 },
      { context: ctx(a.headers) },
    )
    expect(listed.items.map((i) => i.handle)).toEqual(['pa'])

    const updated = await call(
      appRouter.products.update,
      { id: pa.id, title: 'Renamed' },
      { context: ctx(a.headers) },
    )
    expect(updated?.title).toBe('Renamed')

    // B cannot touch A's product even by id: RLS returns nothing to update.
    const crossStore = await call(
      appRouter.products.update,
      { id: pa.id, title: 'Hijacked' },
      { context: ctx(b.headers) },
    )
    expect(crossStore).toBeNull()
    const [fresh] = await owner.select().from(product).where(eq(product.id, pa.id))
    expect(fresh?.title).toBe('Renamed')
  })

  it('rejects an unauthenticated caller and one with no active store', async () => {
    await expect(
      call(appRouter.products.list, { page: 1, perPage: 10 }, { context: ctx(new Headers()) }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' } satisfies Partial<ORPCError<string, unknown>>)

    await auth.api.sendVerificationOTP({ body: { email: 'c@example.com', type: 'sign-in' } })
    const res = await auth.api.signInEmailOTP({
      body: { email: 'c@example.com', otp: sent.at(-1)?.otp as string },
      asResponse: true,
    })
    const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
    await expect(
      call(appRouter.products.list, { page: 1, perPage: 10 }, { context: ctx(headers) }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })
})
