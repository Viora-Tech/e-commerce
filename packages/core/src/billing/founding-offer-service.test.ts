/** SOURCE OF TRUTH: founding offer database tests — WHAT: sign-ups taking the 20 places (also at once), the 30-day trial, a founding bill's sales order and invoice discount, the 12 months counted from paid bills, renewal at the normal price, AutoPay at ₹999 for the months left / WHY: the cap and the end of the offer must hold under real transactions */
import { randomUUID } from 'node:crypto'
import { createDb, order, orderNote, planPayment, storePlan, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { seedSalesStore, seedStore } from '../testing/usage-seed'
import { type AutopayConfig, startAutopay } from './autopay'
import { FOUNDING_OFFER_LABEL } from './founding-offer'
import { loadFoundingState, startSignupPlan } from './founding-offer-service'
import { addInterval } from './plans'
import { type BillingEnv, choosePlan, loadPlanView } from './service'

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
const t0 = new Date('2026-11-27T06:00:00Z')

const signUp = (id: string, open = true) =>
  withStore(app, id, (tx) => startSignupPlan(tx, id, t0, open))

/** `n` paid bills at the founding price, a month each from `from`. */
async function seedFoundingMonths(storeId: string, n: number, from = t0) {
  let start = from
  for (let i = 0; i < n; i++) {
    const end = addInterval(start, 'month')
    await owner.insert(planPayment).values({
      storeId,
      plan: 'growth',
      interval: 'month',
      salesOrderId: randomUUID(),
      salesOrderNumber: 100 + i,
      amountPaise: 1_17_882,
      periodStart: start,
      periodEnd: end,
      status: 'paid',
      paidAt: start,
      foundingOffer: true,
    })
    start = end
  }
}

async function salesEnv(): Promise<BillingEnv> {
  return {
    salesStoreId: await seedSalesStore(owner),
    settingsSecret: 'test-secret-test-secret-test-secret',
    salesStorefrontUrl: 'https://sales.example.test',
  }
}

describe('founding places at sign-up', () => {
  it('gives the first 20 a 30-day trial and a place, then the usual 14 days', async () => {
    const ids: string[] = []
    for (let i = 0; i < 21; i++) ids.push(await seedStore(owner, `shop-${i}`))
    // All at once: the advisory lock keeps the count and the insert one step.
    const rows = await Promise.all(ids.map((id) => signUp(id)))
    const founding = rows.filter((r) => r.foundingOfferAt !== null)
    expect(founding).toHaveLength(20)
    for (const r of founding) expect(r.trialEndsAt?.getTime()).toBe(t0.getTime() + 30 * DAY)
    const [late] = rows.filter((r) => r.foundingOfferAt === null)
    expect(late).toMatchObject({ plan: 'growth', status: 'trialing' })
    expect(late?.trialEndsAt?.getTime()).toBe(t0.getTime() + 14 * DAY)
  })

  it('gives no place while the offer is closed, and keeps a row that exists', async () => {
    const id = await seedStore(owner, 'closed')
    expect((await signUp(id, false)).foundingOfferAt).toBeNull()
    // Signing up again (a retry) leaves the row alone, even with the offer open.
    expect((await signUp(id, true)).foundingOfferAt).toBeNull()
  })
})

describe('founding bills', () => {
  it('bills a trial choosing Growth at ₹999 + GST, "Founding offer" on the invoice', async () => {
    const env = await salesEnv()
    const id = await seedStore(owner, 'asha')
    await signUp(id)
    const view = await withStore(app, id, (tx) => loadPlanView(tx, id, env, t0))
    expect(view.founding).toMatchObject({ monthsLeft: 12, pricePaise: 99_900 })
    const r = await choosePlan(app, id, { plan: 'growth', interval: 'month' }, env, t0)
    expect(r.bill).toMatchObject({ plan: 'growth', amountPaise: 1_17_882 })
    const [bill] = await owner.select().from(planPayment).where(eq(planPayment.storeId, id))
    expect(bill).toMatchObject({ foundingOffer: true, prorated: false })
    const [o] = await owner
      .select()
      .from(order)
      .where(eq(order.id, bill?.salesOrderId as string))
    expect(o).toMatchObject({
      totalPaise: 1_17_882,
      taxPaise: 17_982,
      discountPaise: 1_18_000,
      discountLabel: FOUNDING_OFFER_LABEL,
    })
    const notes = await owner
      .select()
      .from(orderNote)
      .where(eq(orderNote.orderId, bill?.salesOrderId as string))
    expect(notes[0]?.body).toContain('Founding offer: Growth at ₹999 a month, month 1 of 12')
  })

  it('counts only paid full founding months, and renews at the normal price after 12', async () => {
    const env = await salesEnv()
    const id = await seedStore(owner, 'meera')
    await signUp(id)
    await seedFoundingMonths(id, 11)
    // A cancelled and a prorated founding bill do not count.
    await owner.insert(planPayment).values([
      {
        storeId: id,
        plan: 'growth',
        interval: 'month',
        salesOrderId: randomUUID(),
        salesOrderNumber: 900,
        amountPaise: 1_17_882,
        periodStart: t0,
        periodEnd: addInterval(t0, 'month'),
        status: 'cancelled',
        foundingOffer: true,
      },
      {
        storeId: id,
        plan: 'growth',
        interval: 'month',
        salesOrderId: randomUUID(),
        salesOrderNumber: 901,
        amountPaise: 50_000,
        periodStart: t0,
        periodEnd: addInterval(t0, 'month'),
        status: 'paid',
        paidAt: t0,
        prorated: true,
        foundingOffer: true,
      },
    ])
    const state = await withStore(app, id, (tx) => loadFoundingState(tx, id))
    expect(state.monthsPaid).toBe(11)

    // Month 12 is still founding; the trial is over, so the bill is for one month from now.
    const later = new Date(t0.getTime() + 40 * DAY)
    const twelfth = await choosePlan(app, id, { plan: 'growth', interval: 'month' }, env, later)
    expect(twelfth.bill?.amountPaise).toBe(1_17_882)
    await owner
      .update(planPayment)
      .set({ status: 'paid', paidAt: later })
      .where(eq(planPayment.id, twelfth.bill?.id as string))

    // Thirteenth: the plan variant's own price, no discount, not founding.
    await owner.update(storePlan).set({ status: 'due' }).where(eq(storePlan.storeId, id))
    const next = await choosePlan(app, id, { plan: 'growth', interval: 'month' }, env, later)
    const [row] = await owner
      .select()
      .from(planPayment)
      .where(eq(planPayment.id, next.bill?.id as string))
    expect(row).toMatchObject({ foundingOffer: false, amountPaise: 1_99_900 })
    const [o] = await owner
      .select()
      .from(order)
      .where(eq(order.id, row?.salesOrderId as string))
    expect(o).toMatchObject({ discountPaise: 0 })
    const view = await withStore(app, id, (tx) => loadPlanView(tx, id, env, later))
    expect(view.founding).toMatchObject({ monthsLeft: 0, monthsPaid: 12 })
  })

  it('a store without a place pays the normal price', async () => {
    const env = await salesEnv()
    const id = await seedStore(owner, 'ravi')
    await signUp(id, false)
    const r = await choosePlan(app, id, { plan: 'growth', interval: 'month' }, env, t0)
    expect(r.bill?.amountPaise).toBe(1_99_900)
    const view = await withStore(app, id, (tx) => loadPlanView(tx, id, env, t0))
    expect(view.founding).toBeNull()
  })
})

describe('founding AutoPay', () => {
  it('subscribes at ₹999 + GST for the founding months left only', async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = []
    const cfg: AutopayConfig = {
      keyId: 'rzp_test_dummykey',
      keySecret: 'dummy_test_secret',
      webhookSecret: 'whsec_test_dummy',
      fetch: (async (url: string, init: RequestInit) => {
        const path = url.replace('https://api.razorpay.com/v1', '')
        calls.push({ path, body: JSON.parse(String(init.body)) })
        return path === '/plans'
          ? Response.json({ id: 'plan_test1' })
          : Response.json({ id: 'sub_test1', short_url: 'https://rzp.io/i/test1' })
      }) as unknown as typeof fetch,
    }
    const id = await seedStore(owner, 'kiran')
    await signUp(id)
    await seedFoundingMonths(id, 3)
    await startAutopay(app, id, { plan: 'growth', interval: 'month' }, cfg)
    const plan = calls.find((c) => c.path === '/plans')
    const sub = calls.find((c) => c.path === '/subscriptions')
    expect(plan?.body.item).toMatchObject({ amount: 1_17_882 })
    expect(sub?.body.total_count).toBe(9)
  })
})
