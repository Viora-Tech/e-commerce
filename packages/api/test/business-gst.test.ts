import { createMerchantAuth } from '@commerce/auth'
import { gstinCheckChar } from '@commerce/core'
import { createDb, role, store, storeMember } from '@commerce/db'
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

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

/** An owner with a store, ready to call the router. */
async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner.insert(store).values({ slug, name: slug, organizationId }).returning()
  if (!s) throw new Error('seed')
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  return { headers, organizationId, storeId: s.id }
}

/** A second member of the store on the given system role. */
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

const gstin = (state: string, pan: string) => {
  const first14 = `${state}${pan}1Z`
  return first14 + gstinCheckChar(first14)
}
const HR = gstin('06', 'AAACW1234A')
const DL_OTHER = gstin('07', 'BBBPK5678B')

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('businessGst router', () => {
  it('owner adds a GSTIN; it becomes the default and store.gstin follows', async () => {
    const m = await merchant('owner@example.com', 'gst-a')
    const reg = await call(
      appRouter.businessGst.addRegistration,
      { gstin: HR },
      { context: ctx(m.headers) },
    )
    expect(reg).toMatchObject({ gstin: HR, isDefault: true, stateName: 'Haryana' })
    const view = await call(appRouter.businessGst.get, undefined, { context: ctx(m.headers) })
    expect(view.businesses.map((b) => b.pan)).toEqual(['AAACW1234A'])
    const [s] = await owner.select().from(store).where(eq(store.id, m.storeId))
    expect(s?.gstin).toBe(HR)
  })

  it('a PAN mismatch is a BAD_REQUEST carrying its code and the plain message', async () => {
    const m = await merchant('owner@example.com', 'gst-b')
    await call(appRouter.businessGst.addRegistration, { gstin: HR }, { context: ctx(m.headers) })
    await expect(
      call(appRouter.businessGst.addRegistration, { gstin: DL_OTHER }, { context: ctx(m.headers) }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'This GST number belongs to a different PAN. Is it another business?',
      data: { code: 'PAN_MISMATCH' },
    })
  })

  it('staff can neither read nor change it; an admin can do both', async () => {
    const m = await merchant('owner@example.com', 'gst-c')
    const staff = await member(m.organizationId, m.storeId, 'staff@example.com', 'staff')
    await expect(
      call(appRouter.businessGst.get, undefined, { context: ctx(staff) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.businessGst.addRegistration, { gstin: HR }, { context: ctx(staff) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const admin = await member(m.organizationId, m.storeId, 'admin@example.com', 'admin')
    const reg = await call(
      appRouter.businessGst.addRegistration,
      { gstin: HR },
      { context: ctx(admin) },
    )
    expect(reg.isDefault).toBe(true)
  })

  it('the Taxes page cannot overwrite a GSTIN that Business and GST owns', async () => {
    const m = await merchant('owner@example.com', 'gst-d')
    const taxes = await call(appRouter.taxes.get, undefined, { context: ctx(m.headers) })
    if (!taxes) throw new Error('no taxes view')
    const form = { ...taxes.form, numbering: taxes.numbering }

    // No registration yet: saving a GSTIN on the Taxes page creates the first one.
    await call(appRouter.taxes.save, { ...form, gstin: HR }, { context: ctx(m.headers) })
    const view = await call(appRouter.businessGst.get, undefined, { context: ctx(m.headers) })
    expect(view.registrations.map((r) => r.gstin)).toEqual([HR])

    await expect(
      call(
        appRouter.taxes.save,
        { ...form, gstin: gstin('07', 'AAACW1234A') },
        { context: ctx(m.headers) },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    // The same GSTIN still saves.
    await call(appRouter.taxes.save, { ...form, gstin: HR }, { context: ctx(m.headers) })
  })
})
