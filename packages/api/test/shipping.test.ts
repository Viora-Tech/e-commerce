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
const sent: { otp: string }[] = []
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

const ctx = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), storeId: s?.id as string, organizationId: org?.id as string }
}

const zoneInput = {
  name: 'South',
  stateCodes: ['KA', 'TN'],
  pincodeRules: [{ pattern: '560*', mode: 'include' as const }],
  rates: [{ name: 'Standard', pricePaise: 4900, freeAbovePaise: 99_900 }],
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('shipping zones router', () => {
  it('creates, lists, updates and deletes zones, and keeps stores apart', async () => {
    const a = await merchant('a@example.com', 'ship-a')
    const zone = await call(appRouter.shipping.zones.create, zoneInput, { context: a.ctx })
    expect(zone.rates).toHaveLength(1)
    expect(zone.rates[0]).toMatchObject({ condition: 'none', codSurchargePaise: null })

    const list = await call(appRouter.shipping.zones.list, undefined, { context: a.ctx })
    expect(list.map((z) => z.name)).toEqual(['South'])

    const updated = await call(
      appRouter.shipping.zones.update,
      { id: zone.id, data: { ...zoneInput, name: 'South India' } },
      { context: a.ctx },
    )
    expect(updated.name).toBe('South India')

    await expect(
      call(
        appRouter.shipping.zones.create,
        { ...zoneInput, pincodeRules: [{ pattern: '56', mode: 'include' }] },
        { context: a.ctx },
      ),
    ).rejects.toThrow()

    const b = await merchant('b@example.com', 'ship-b')
    expect(await call(appRouter.shipping.zones.list, undefined, { context: b.ctx })).toEqual([])
    expect(await call(appRouter.shipping.zones.get, { id: zone.id }, { context: b.ctx })).toBeNull()
    await expect(
      call(appRouter.shipping.zones.update, { id: zone.id, data: zoneInput }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(
      await call(appRouter.shipping.zones.delete, { id: zone.id }, { context: b.ctx }),
    ).toEqual({ deleted: false })

    expect(
      await call(appRouter.shipping.zones.delete, { id: zone.id }, { context: a.ctx }),
    ).toEqual({ deleted: true })
  })

  it('refuses staff without the settings permissions', async () => {
    const boss = await merchant('boss@example.com', 'ship-c')
    await call(appRouter.staff.me, {}, { context: boss.ctx })
    const helperHeaders = await signIn('helper@example.com')
    const helper = await auth.api.getSession({ headers: helperHeaders })
    await auth.api.addMember({
      body: {
        userId: helper?.user.id as string,
        role: 'member',
        organizationId: boss.organizationId,
      },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    const [staff] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'staff')))
    await owner
      .insert(storeMember)
      .values({
        storeId: boss.storeId,
        userId: helper?.user.id as string,
        roleId: staff?.id as string,
      })
      .onConflictDoNothing()
    await owner
      .update(storeMember)
      .set({ roleId: staff?.id as string })
      .where(eq(storeMember.userId, helper?.user.id as string))

    const helperCtx = ctx(helperHeaders)
    await expect(
      call(appRouter.shipping.zones.list, undefined, { context: helperCtx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.shipping.zones.create, zoneInput, { context: helperCtx }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
