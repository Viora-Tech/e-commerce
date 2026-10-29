import { createMerchantAuth } from '@commerce/auth'
import {
  createDb,
  order,
  planPayment,
  role,
  rolePermission,
  store,
  storeMember,
  storePlan,
  usageBill,
} from '@commerce/db'
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

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string, orgId: org?.id as string }
}

/** A second member of `m`'s store on a custom role that holds only `perms`. */
async function memberWith(m: { storeId: string; orgId: string }, email: string, perms: string[]) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const userId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId: m.orgId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: m.orgId } })
  const [r] = await owner
    .insert(role)
    .values({ storeId: m.storeId, name: 'Bookkeeper', slug: 'bookkeeper' })
    .returning()
  await owner
    .insert(rolePermission)
    .values(
      perms.map((permission) => ({ storeId: m.storeId, roleId: r?.id as string, permission })),
    )
  const [existing] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, m.storeId), eq(storeMember.userId, userId)))
  if (existing)
    await owner
      .update(storeMember)
      .set({ roleId: r?.id as string })
      .where(eq(storeMember.id, existing.id))
  else
    await owner.insert(storeMember).values({ storeId: m.storeId, userId, roleId: r?.id as string })
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

/** A Starter store paid for the whole of this month, with `n` orders of ₹2,000 placed today. */
async function starterWithOrders(storeId: string, n: number) {
  const now = Date.now()
  const start = new Date(now - 20 * 86_400_000)
  const end = new Date(now + 20 * 86_400_000)
  await owner.insert(planPayment).values({
    storeId,
    plan: 'starter',
    interval: 'month',
    salesOrderId: crypto.randomUUID(),
    salesOrderNumber: 1,
    amountPaise: 58_882,
    periodStart: start,
    periodEnd: end,
    status: 'paid',
    paidAt: start,
  })
  await owner
    .insert(storePlan)
    .values({ storeId, plan: 'starter', status: 'active', periodStart: start, periodEnd: end })
  await owner.insert(order).values(
    Array.from({ length: n }, (_, i) => ({
      storeId,
      number: 1001 + i,
      email: 'buyer@x.in',
      subtotalPaise: 2_00_000,
      totalPaise: 2_00_000,
      status: 'open' as const,
      paymentStatus: 'paid' as const,
      placedAt: new Date(now - (n - i) * 1000),
    })),
  )
}

describe('billing router', () => {
  it("view returns this month's fee estimate and usage bills", async () => {
    const m = await merchant('fees@example.com', 'fees-a')
    await starterWithOrders(m.storeId, 53)
    await owner.insert(usageBill).values({
      storeId: m.storeId,
      month: '2026-01',
      ordersCounted: 60,
      feeOrders: 10,
      feePaise: 20_000,
      totalPaise: 20_000,
      status: 'paid',
    })
    const view = await call(appRouter.billing.view, undefined, { context: m.ctx })
    expect(view.fees).toMatchObject({ ordersCounted: 53, feeOrders: 3, feePaise: 6_000 })
    expect(view.usageBills).toEqual([
      expect.objectContaining({
        month: '2026-01',
        feeOrders: 10,
        totalPaise: 20_000,
        status: 'paid',
      }),
    ])
    expect(view.fairUseNotice).toBe(false)
    expect(view.unpaidFees).toBe(0)
    const usage = await call(appRouter.billing.usage, undefined, { context: m.ctx })
    expect(usage).toMatchObject({ plan: 'starter', used: 53, limit: 50, feeBasisPoints: 100 })
  })

  it('usageBillCsv lists the fee orders of that month only, for the signed-in store', async () => {
    const a = await merchant('csv-a@example.com', 'csv-a')
    const b = await merchant('csv-b@example.com', 'csv-b')
    await starterWithOrders(a.storeId, 52)
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
    const [bill] = await owner
      .insert(usageBill)
      .values({
        storeId: a.storeId,
        month,
        ordersCounted: 52,
        feeOrders: 2,
        feePaise: 4_000,
        totalPaise: 4_000,
        status: 'carried',
      })
      .returning()
    const { filename, csv } = await call(
      appRouter.billing.usageBillCsv,
      { id: bill?.id as string },
      { context: a.ctx },
    )
    expect(filename).toBe(`per-order-fees-${month}.csv`)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('Order,Placed at,Order total (₹),Plan,Fee (₹)')
    expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual(['#1051', '#1052'])
    expect(lines[1]?.endsWith(',2000.00,Starter,20.00')).toBe(true)
    await expect(
      call(appRouter.billing.usageBillCsv, { id: bill?.id as string }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // It lists order numbers and totals: a member who can't see orders can't download it.
    const bookkeeper = await memberWith(a, 'books@example.com', ['settings.read'])
    await expect(
      call(appRouter.billing.usageBillCsv, { id: bill?.id as string }, { context: bookkeeper }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
