import { createMerchantAuth } from '@commerce/auth'
import { createDb, role, store, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { defaultProgramRules } from '@commerce/plugin-affiliates/settings'
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

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

/** An owner with a store that has the Affiliates app (with a v1 settings entry). */
async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      organizationId,
      apps: {
        installed: ['affiliates'],
        settings: { affiliates: { holdDays: 5, commission: { type: 'percent', bp: 1500 } } },
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return { headers, organizationId, storeId: s.id }
}

async function member(organizationId: string, storeId: string, email: string, slug: string) {
  const headers = await signIn(email)
  const session = await auth.api.getSession({ headers })
  const userId = session?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [r] = await owner
    .select()
    .from(role)
    .where(and(eq(role.storeId, storeId), eq(role.slug, slug)))
  if (!r) throw new Error(`no ${slug} role`)
  await owner.insert(storeMember).values({ storeId, userId, roleId: r.id })
  return headers
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('affiliate programs API', () => {
  it('starts from the v1 entry, keeps store settings apart, and moves an affiliate', async () => {
    const m = await merchant('owner@example.com', 'aff-programs-a')
    const c = { context: ctx(m.headers) }
    const [fallback] = await call(appRouter.affiliates.programs.list, undefined, c)
    expect(fallback).toMatchObject({ name: 'Default', isDefault: true, affiliates: 0 })
    expect(fallback?.rules.commission).toEqual({ type: 'percent', bp: 1500 })

    const settings = await call(appRouter.affiliates.settings.get, undefined, c)
    expect(settings).toMatchObject({ holdDays: 5 })
    expect(settings).not.toHaveProperty('commission')
    await call(appRouter.affiliates.settings.save, { ...settings, holdDays: 9 }, c)
    const [s] = await owner.select({ apps: store.apps }).from(store).where(eq(store.id, m.storeId))
    // The v1 program keys stay in the entry, unread.
    const apps = s?.apps as { settings: { affiliates: unknown } } | undefined
    expect(apps?.settings.affiliates).toMatchObject({
      holdDays: 9,
      commission: { type: 'percent', bp: 1500 },
    })

    const vip = await call(
      appRouter.affiliates.programs.create,
      { name: 'VIP', rules: { ...defaultProgramRules, coupon: { enabled: true, bp: 2000 } } },
      c,
    )
    const a = await call(
      appRouter.affiliates.add,
      { name: 'Asha', email: 'asha@example.com', social: '', approve: true },
      c,
    )
    expect(a.programId).toBe(fallback?.id)
    await call(appRouter.affiliates.setProgram, { id: a.id, programId: vip.id }, c)
    await call(appRouter.affiliates.setRate, { id: a.id, rule: { type: 'percent', bp: 2500 } }, c)
    const detail = await call(appRouter.affiliates.get, { id: a.id }, c)
    expect(detail.program?.id).toBe(vip.id)
    expect(detail.affiliate.rateOverride).toEqual({ type: 'percent', bp: 2500 })
    const list = await call(appRouter.affiliates.list, undefined, c)
    expect(list[0]?.programName).toBe('VIP')
    await call(appRouter.affiliates.programs.archive, { id: vip.id, moveTo: fallback?.id ?? '' }, c)
    expect((await call(appRouter.affiliates.get, { id: a.id }, c)).program?.id).toBe(fallback?.id)
  })

  it('staff can neither read nor change programs', async () => {
    const m = await merchant('owner@example.com', 'aff-programs-b')
    const staff = await member(m.organizationId, m.storeId, 'staff@example.com', 'staff')
    const c = { context: ctx(staff) }
    await expect(call(appRouter.affiliates.programs.list, undefined, c)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(
      call(appRouter.affiliates.programs.create, { name: 'X', rules: defaultProgramRules }, c),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(
        appRouter.affiliates.setRate,
        { id: '00000000-0000-4000-8000-000000000001', rule: null },
        c,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.affiliates.payouts.tdsReport, { fy: 2026, quarter: 3 }, c),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const report = await call(
      appRouter.affiliates.payouts.tdsReport,
      { fy: 2026, quarter: 3 },
      { context: ctx(m.headers) },
    )
    expect(report.csv).toContain('"Deductee name","PAN","Section"')
  })
})
