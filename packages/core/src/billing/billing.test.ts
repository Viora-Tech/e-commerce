/** SOURCE OF TRUTH: plan billing tests — WHAT: choosing plans, bills and renewals / WHY: a bill must become a paid order on the sales store */
import {
  aiSettings,
  createDb,
  order,
  orderLine,
  planPayment,
  store,
  storePlan,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { seedPaidPeriod, seedSalesStore } from '../testing/usage-seed'
import { addInterval } from './plans'
import {
  type BillingEnv,
  choosePlan,
  ensureStorePlan,
  loadPlanChangeQuote,
  loadPlanView,
  markPlanBillPaid,
  runBillingSweep,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY = 86_400_000
const t0 = new Date('2026-10-18T06:00:00Z')
const env: BillingEnv = {
  salesStoreId: undefined,
  settingsSecret: 'test-secret-test-secret-test-secret',
  salesStorefrontUrl: null,
}

async function seedStore(slug = 'asha') {
  const [s] = await owner.insert(store).values({ slug, name: 'Asha Handlooms' }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

/** A bill as createPlanBill would leave it, without a sales store behind it. */
async function seedBill(storeId: string, salesOrderId: string, start: Date) {
  await owner.insert(planPayment).values({
    storeId,
    plan: 'pro',
    interval: 'month',
    salesOrderId,
    salesOrderNumber: 1042,
    amountPaise: 5_89_882,
    periodStart: start,
    periodEnd: addInterval(start, 'month'),
    status: 'due',
  })
}

describe('addInterval', () => {
  it('keeps the day, or the last day of a shorter month', () => {
    expect(addInterval(new Date('2026-01-31T00:00:00Z'), 'month').toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    )
    expect(addInterval(new Date('2026-10-18T00:00:00Z'), 'year').toISOString()).toBe(
      '2027-10-18T00:00:00.000Z',
    )
  })
})

describe('store plan', () => {
  it('starts a 14-day Growth trial on first read', async () => {
    const id = await seedStore()
    const row = await withStore(app, id, (tx) => ensureStorePlan(tx, id, t0))
    expect(row).toMatchObject({ plan: 'growth', interval: 'month', status: 'trialing' })
    expect(row.trialEndsAt?.getTime()).toBe(t0.getTime() + 14 * DAY)
    const view = await withStore(app, id, (tx) => loadPlanView(tx, id, env, t0))
    expect(view).toMatchObject({ status: 'trialing', bills: [], due: null, billingReady: false })
  })

  it('a paid bill moves the store onto that plan and its AI tier', async () => {
    const id = await seedStore()
    await withStore(app, id, (tx) => ensureStorePlan(tx, id, t0))
    await owner.insert(aiSettings).values({ storeId: id }).onConflictDoNothing()
    const orderId = '01a0e000-0000-7000-8000-000000000001'
    await seedBill(id, orderId, t0)
    const paidAt = new Date(t0.getTime() + DAY)
    expect(await markPlanBillPaid(app, orderId, paidAt)).toEqual({ storeId: id })
    const [plan] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(plan).toMatchObject({ plan: 'pro', status: 'active' })
    // Paid a day late: the month starts when the money arrived.
    expect(plan?.periodStart?.getTime()).toBe(paidAt.getTime())
    const [ai] = await owner.select().from(aiSettings).where(eq(aiSettings.storeId, id))
    expect(ai?.plan).toBe('pro')
    // Running twice changes nothing.
    await markPlanBillPaid(app, orderId, new Date(paidAt.getTime() + DAY))
    const [again] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(again?.periodStart?.getTime()).toBe(paidAt.getTime())
  })

  it('an unknown order is not a plan bill', async () => {
    expect(await markPlanBillPaid(app, '01a0e000-0000-7000-8000-0000000000ff', t0)).toBeNull()
  })

  it('a downgrade on an active plan waits for the period to end', async () => {
    const id = await seedStore()
    await withStore(app, id, (tx) => ensureStorePlan(tx, id, t0))
    await owner
      .update(storePlan)
      .set({ plan: 'pro', status: 'active', periodStart: t0, periodEnd: addInterval(t0, 'month') })
      .where(eq(storePlan.storeId, id))
    const r = await choosePlan(app, id, { plan: 'growth', interval: 'month' }, env, t0)
    expect(r).toEqual({ bill: null, scheduled: true })
    const [plan] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(plan).toMatchObject({ plan: 'pro', nextPlan: 'growth' })
  })

  it('an upgrade without a sales store says billing is not ready', async () => {
    const id = await seedStore()
    await expect(choosePlan(app, id, { plan: 'pro', interval: 'month' }, env, t0)).rejects.toThrow(
      'Billing is not set up: no_sales_store',
    )
  })
})

describe('runBillingSweep', () => {
  it('marks an ended trial due, then pauses it after the grace period', async () => {
    const id = await seedStore()
    await withStore(app, id, (tx) => ensureStorePlan(tx, id, t0))
    const afterTrial = new Date(t0.getTime() + 15 * DAY)
    expect(await runBillingSweep(app, env, afterTrial)).toMatchObject({ stores: 1, due: 1 })
    const [due] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(due?.status).toBe('due')
    const afterGrace = new Date(t0.getTime() + 22 * DAY)
    expect(await runBillingSweep(app, env, afterGrace)).toMatchObject({ paused: 1 })
    const [paused] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(paused?.status).toBe('paused')
  })

  it('leaves a store with time left alone', async () => {
    const id = await seedStore()
    await withStore(app, id, (tx) => ensureStorePlan(tx, id, t0))
    expect(await runBillingSweep(app, env, t0)).toMatchObject({ stores: 0 })
  })
})

describe('a prorated upgrade', () => {
  // 1 Nov to 1 Dec in India; the owner moves Growth to Pro on 11 Nov with 20 days left.
  const NOV1 = new Date('2026-10-31T18:30:00Z')
  const DEC1 = addInterval(NOV1, 'month')
  const NOV11 = new Date('2026-11-11T04:30:00Z')

  async function growthStore() {
    const salesEnv: BillingEnv = {
      salesStoreId: await seedSalesStore(owner),
      settingsSecret: 'test-secret-test-secret-test-secret',
      salesStorefrontUrl: 'https://sales.example.test',
    }
    const id = await seedStore()
    await seedPaidPeriod(owner, id, 'growth', NOV1, DEC1)
    return { id, salesEnv }
  }

  it('charges exactly what the quote showed, for the rest of the period', async () => {
    const { id, salesEnv } = await growthStore()
    const quote = await loadPlanChangeQuote(app, id, { plan: 'pro', interval: 'month' }, NOV11)
    expect(quote).toMatchObject({ kind: 'charge', totalPaise: 2_36_000, creditPaise: 1_33_267 })
    const r = await choosePlan(app, id, { plan: 'pro', interval: 'month' }, salesEnv, NOV11)
    expect(r.scheduled).toBe(false)
    expect(r.bill).toMatchObject({ plan: 'pro', amountPaise: 2_36_000, periodEnd: DEC1 })
    const [bill] = await owner.select().from(planPayment).where(eq(planPayment.status, 'due'))
    expect(bill).toMatchObject({ prorated: true, creditPaise: 1_33_267, amountPaise: 2_36_000 })
    // The sales order: one plan line at the quote's total, GST extracted from it.
    const [o] = await owner
      .select()
      .from(order)
      .where(eq(order.id, bill?.salesOrderId as string))
    expect(o).toMatchObject({ totalPaise: 2_36_000, taxPaise: 36_000 })
    const lines = await owner
      .select({ unit: orderLine.unitPricePaise })
      .from(orderLine)
      .where(eq(orderLine.orderId, bill?.salesOrderId as string))
    expect(lines.map((l) => l.unit)).toEqual([2_36_000])

    // Paid the same day: Pro from now, renewing on 1 Dec as before.
    const paidAt = new Date(NOV11.getTime() + 3_600_000)
    await markPlanBillPaid(app, bill?.salesOrderId as string, paidAt)
    const [plan] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(plan).toMatchObject({ plan: 'pro', status: 'active', periodEnd: DEC1 })
    expect(plan?.periodStart?.getTime()).toBe(paidAt.getTime())
  })

  it('a trial is billed at the plan variant price, nothing credited', async () => {
    const { salesEnv } = await growthStore()
    const id = await seedStore('meera')
    await withStore(app, id, (tx) => ensureStorePlan(tx, id, NOV11))
    const r = await choosePlan(app, id, { plan: 'pro', interval: 'month' }, salesEnv, NOV11)
    expect(r.bill).toMatchObject({ amountPaise: 5_89_882 })
    const quote = await loadPlanChangeQuote(app, id, { plan: 'pro', interval: 'month' }, NOV11)
    expect(quote).toMatchObject({ kind: 'charge', totalPaise: 5_89_882, creditPaise: 0 })
  })

  it('refuses the plan the store is already on', async () => {
    const { id, salesEnv } = await growthStore()
    await expect(
      choosePlan(app, id, { plan: 'growth', interval: 'month' }, salesEnv, NOV11),
    ).rejects.toThrow('already on that plan')
  })
})
