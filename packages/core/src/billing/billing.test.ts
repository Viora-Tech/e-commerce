import { aiSettings, createDb, planPayment, store, storePlan, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addInterval } from './plans'
import {
  type BillingEnv,
  choosePlan,
  ensureStorePlan,
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
