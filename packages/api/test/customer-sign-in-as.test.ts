import { createMerchantAuth } from '@commerce/auth'
import { createDb, customer, customerNote, role, store, storeMember } from '@commerce/db'
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

function ctx(headers: Headers): ApiContext {
  return { db: app, auth, headers, notifications: { add: async () => undefined } }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A store with its owner signed in, the system roles seeded and one customer. */
async function seed() {
  const headers = await signIn('owner@example.com')
  const org = await auth.api.createOrganization({
    headers,
    body: { name: 'sign-in-as', slug: 'sign-in-as' },
  })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug: 'sign-in-as', name: 'Test store', organizationId })
    .returning()
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s?.id as string, email: 'shopper@example.com', name: 'Test Shopper' })
    .returning()
  return { headers, organizationId, storeId: s?.id as string, customerId: c?.id as string }
}

describe('customers.signInAs', () => {
  it('gives the owner a single-use storefront link and notes it on the timeline', async () => {
    const { headers, customerId } = await seed()
    const { url } = await call(
      appRouter.customers.signInAs,
      { id: customerId },
      { context: ctx(headers) },
    )
    const link = new URL(url)
    expect(link.pathname).toBe('/account/login/staff')
    expect(link.searchParams.get('token')).toMatch(/^[A-Za-z0-9_-]{40,60}$/)
    const notes = await owner
      .select()
      .from(customerNote)
      .where(eq(customerNote.customerId, customerId))
    expect(notes).toHaveLength(1)
  })

  it('refuses an administrator, whose role starts without the permission', async () => {
    const { organizationId, storeId, customerId } = await seed()
    const helperHeaders = await signIn('helper@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({ body: { userId: helperId, role: 'member', organizationId } })
    await auth.api.setActiveOrganization({ headers: helperHeaders, body: { organizationId } })
    const [admin] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, storeId), eq(role.slug, 'admin')))
    const roleId = admin?.id as string
    const mine = and(eq(storeMember.storeId, storeId), eq(storeMember.userId, helperId))
    const [existing] = await owner.select().from(storeMember).where(mine)
    if (existing) await owner.update(storeMember).set({ roleId }).where(mine)
    else await owner.insert(storeMember).values({ storeId, userId: helperId, roleId })

    await expect(
      call(appRouter.customers.signInAs, { id: customerId }, { context: ctx(helperHeaders) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
