/** SOURCE OF TRUTH: monthly usage bill tests — WHAT: the 1st's per-order fee bill, carry-forward, pay and cancel / WHY: a store must be billed once, only for real orders in paid time */
import {
  autopayMandate,
  createDb,
  order,
  orderLine,
  planPayment,
  storePlan,
  usageBill,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ordersFrom,
  seedOrders,
  seedPaidPeriod,
  seedSalesStore,
  seedStore,
} from '../testing/usage-seed'
import {
  type BillingEnv,
  cancelPlanBill,
  cancelUsageBill,
  choosePlan,
  loadPlanView,
  markPlanBillPaid,
  markUsageBillPaid,
  runBillingSweep,
  runUsageBilling,
  runUsageReminders,
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

// Midnight in India on the 1st of each month.
const OCT = new Date('2026-09-30T18:30:00Z')
const NOV = new Date('2026-10-31T18:30:00Z')
const DEC = new Date('2026-11-30T18:30:00Z')
/** Half an hour into 1 Nov and 1 Dec, IST: the sweep's first run of the month. */
const NOV_RUN = new Date('2026-10-31T19:00:00Z')
const DEC_RUN = new Date('2026-11-30T19:00:00Z')

async function billingEnv(without: string[] = []): Promise<BillingEnv> {
  return {
    salesStoreId: await seedSalesStore(owner, without),
    settingsSecret: 'test-secret-test-secret-test-secret',
    salesStorefrontUrl: 'https://sales.example.test',
  }
}

const rows = (storeId: string) =>
  owner.select().from(usageBill).where(eq(usageBill.storeId, storeId)).orderBy(usageBill.month)

describe('runUsageBilling', () => {
  it('bills last month on the first run of a month and not again', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
    await seedOrders(owner, id, ordersFrom(60, new Date('2026-10-05T06:00:00Z'), 2_00_000))

    const first = await runUsageBilling(app, env, NOV_RUN)
    expect(first).toEqual({ stores: 1, billed: 1, carried: 0 })
    const [bill] = await rows(id)
    expect(bill).toMatchObject({
      month: '2026-10',
      ordersCounted: 60,
      feeOrders: 10,
      feePaise: 20_000,
      totalPaise: 20_000,
      status: 'due',
    })
    // The sales order carries the fee as a computed line.
    const lines = await owner
      .select({ unit: orderLine.unitPricePaise })
      .from(orderLine)
      .where(eq(orderLine.orderId, bill?.salesOrderId as string))
    expect(lines.map((l) => l.unit)).toEqual([20_000])

    const again = await runUsageBilling(app, env, new Date(NOV_RUN.getTime() + 3_600_000))
    expect(again.billed).toBe(0)
    expect(await rows(id)).toHaveLength(1)
  })

  it('leaves out an order refunded in full before the bill is made', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
    const ids = await seedOrders(
      owner,
      id,
      ordersFrom(70, new Date('2026-10-05T06:00:00Z'), 2_00_000),
    )
    await owner
      .update(order)
      .set({ paymentStatus: 'refunded' })
      .where(eq(order.id, ids[69] as string))
    await runUsageBilling(app, env, NOV_RUN)
    const [bill] = await rows(id)
    expect(bill?.feeOrders).toBe(19)
  })

  it('never bills a store that never paid', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedOrders(owner, id, ordersFrom(400, new Date('2026-10-05T06:00:00Z')))
    expect(await runUsageBilling(app, env, NOV_RUN)).toEqual({ stores: 0, billed: 0, carried: 0 })
    expect(await rows(id)).toHaveLength(0)
  })

  it('carries under ₹100 and bills it next month', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, DEC)
    // October: 53 orders → 3 × ₹20 = ₹60. November: 51 orders of ₹5,000 → ₹50.
    await seedOrders(owner, id, ordersFrom(53, new Date('2026-10-05T06:00:00Z'), 2_00_000))
    await seedOrders(owner, id, ordersFrom(51, new Date('2026-11-05T06:00:00Z'), 5_00_000))

    expect(await runUsageBilling(app, env, NOV_RUN)).toMatchObject({ billed: 0, carried: 1 })
    expect(await rows(id)).toMatchObject([
      { month: '2026-10', status: 'carried', totalPaise: 6_000 },
    ])

    expect(await runUsageBilling(app, env, DEC_RUN)).toMatchObject({ billed: 1 })
    expect(await rows(id)).toMatchObject([
      { month: '2026-10', status: 'merged' },
      {
        month: '2026-11',
        status: 'due',
        feePaise: 5_000,
        carriedInPaise: 6_000,
        totalPaise: 11_000,
      },
    ])
    // Paying November's bill settles the October fees it carried.
    const [, nov] = await rows(id)
    await markUsageBillPaid(app, nov?.salesOrderId as string, DEC_RUN)
    expect((await rows(id)).map((r) => r.status)).toEqual(['paid', 'paid'])
  })

  it('keeps a carried amount when the next month has no fee', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, DEC)
    await seedOrders(owner, id, ordersFrom(53, new Date('2026-10-05T06:00:00Z'), 2_00_000))
    await runUsageBilling(app, env, NOV_RUN)
    await runUsageBilling(app, env, DEC_RUN)
    expect(await rows(id)).toMatchObject([
      { month: '2026-10', status: 'merged', totalPaise: 6_000 },
      {
        month: '2026-11',
        status: 'carried',
        feePaise: 0,
        carriedInPaise: 6_000,
        totalPaise: 6_000,
      },
    ])
  })

  it('pays and cancels by sales order, never touching the plan status', async () => {
    const env = await billingEnv()
    const a = await seedStore(owner, 'asha')
    const b = await seedStore(owner, 'bela')
    for (const id of [a, b]) {
      await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
      await seedOrders(owner, id, ordersFrom(60, new Date('2026-10-05T06:00:00Z'), 2_00_000))
    }
    await runUsageBilling(app, env, NOV_RUN)
    const [billA] = await rows(a)
    const [billB] = await rows(b)

    expect(await markUsageBillPaid(app, billA?.salesOrderId as string, NOV_RUN)).toEqual({
      storeId: a,
    })
    await cancelUsageBill(app, billB?.salesOrderId as string)
    expect((await rows(a))[0]).toMatchObject({ status: 'paid', paidAt: NOV_RUN })
    expect((await rows(b))[0]).toMatchObject({ status: 'cancelled' })
    const plans = await owner.select({ status: storePlan.status }).from(storePlan)
    expect(plans.map((p) => p.status)).toEqual(['active', 'active'])
    expect(await markUsageBillPaid(app, crypto.randomUUID())).toBeNull()
  })
})

describe('unpaid fee bills and the next plan bill', () => {
  it('adds an unpaid usage bill to the renewal and settles it when paid', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    // Paid to 6 Nov: the 1st's run (sweep first, as the worker runs it) bills no renewal yet.
    const renews = new Date(NOV.getTime() + 5 * 86_400_000)
    await seedPaidPeriod(owner, id, 'starter', OCT, renews)
    await seedOrders(owner, id, ordersFrom(60, new Date('2026-10-05T06:00:00Z'), 2_00_000))
    await runBillingSweep(app, env, NOV_RUN)
    await runUsageBilling(app, env, NOV_RUN)
    const [fee] = await rows(id)
    expect(fee?.status).toBe('due')

    // Three days before the period ends the sweep bills the renewal, and the unpaid fee rides on it.
    await runBillingSweep(app, env, new Date(renews.getTime() - 2 * 86_400_000))
    const [renewal] = await owner.select().from(planPayment).where(eq(planPayment.status, 'due'))
    const planOrder = renewal?.salesOrderId as string
    const lines = await owner
      .select({ unit: orderLine.unitPricePaise })
      .from(orderLine)
      .where(eq(orderLine.orderId, planOrder))
    expect(lines.map((l) => l.unit).sort((a, b) => a - b)).toEqual([20_000, 49_900])
    expect((await rows(id))[0]).toMatchObject({
      status: 'merged',
      mergedIntoSalesOrderId: planOrder,
    })
    const [old] = await owner
      .select({ status: order.status })
      .from(order)
      .where(eq(order.id, fee?.salesOrderId as string))
    expect(old?.status).toBe('cancelled')

    // The old order's cancel hook leaves the merged bill owed through the plan bill.
    await cancelUsageBill(app, fee?.salesOrderId as string)
    expect((await rows(id))[0]?.status).toBe('merged')

    await markPlanBillPaid(app, planOrder, NOV_RUN)
    expect((await rows(id))[0]).toMatchObject({ status: 'paid', paidAt: NOV_RUN })
  })

  it("an AutoPay store's usage bill stays due and the plan keeps its status", async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    // Renews two days after the fee bill: inside the sweep's billing window.
    const renews = new Date(NOV.getTime() + 2 * 86_400_000)
    await seedPaidPeriod(owner, id, 'starter', OCT, renews)
    await owner.insert(autopayMandate).values({
      storeId: id,
      plan: 'starter',
      interval: 'month',
      subscriptionId: 'sub_test',
      status: 'active',
    })
    await seedOrders(owner, id, ordersFrom(60, new Date('2026-10-05T06:00:00Z'), 2_00_000))
    await runUsageBilling(app, env, NOV_RUN)
    await runBillingSweep(app, env, NOV_RUN)
    expect((await rows(id))[0]?.status).toBe('due')
    const [plan] = await owner.select({ status: storePlan.status }).from(storePlan)
    expect(plan?.status).toBe('active')
  })
})

/** A Starter store with October paid and 60 orders of ₹2,000: a ₹200 fee bill on 1 Nov. */
async function storeWithFeeBill(env: BillingEnv, slug = 'asha') {
  const id = await seedStore(owner, slug)
  await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
  await seedOrders(owner, id, ordersFrom(60, new Date('2026-10-05T06:00:00Z'), 2_00_000))
  await runUsageBilling(app, env, NOV_RUN)
  return id
}

const lineUnits = async (orderId: string) =>
  (
    await owner
      .select({ unit: orderLine.unitPricePaise })
      .from(orderLine)
      .where(eq(orderLine.orderId, orderId))
  )
    .map((l) => l.unit)
    .sort((a, b) => a - b)

const duePlanOrder = async () =>
  (await owner.select().from(planPayment).where(eq(planPayment.status, 'due')))[0]
    ?.salesOrderId as string

describe('fee bills never get lost or billed twice', () => {
  it('a fee on a replaced renewal bill moves to the new plan bill', async () => {
    const env = await billingEnv()
    const id = await storeWithFeeBill(env)
    await runBillingSweep(app, env, NOV_RUN)
    const first = await duePlanOrder()
    await choosePlan(app, id, { plan: 'growth', interval: 'month' }, env, NOV_RUN)
    const second = await duePlanOrder()
    expect(second).not.toBe(first)
    expect(await lineUnits(second)).toEqual([20_000, 1_99_900])
    expect((await rows(id))[0]).toMatchObject({ status: 'merged', mergedIntoSalesOrderId: second })
  })

  it('a cancelled plan bill gives its fees back as owed', async () => {
    const env = await billingEnv()
    const id = await storeWithFeeBill(env)
    await runBillingSweep(app, env, NOV_RUN)
    await cancelPlanBill(app, await duePlanOrder())
    expect((await rows(id))[0]).toMatchObject({
      status: 'due',
      mergedIntoSalesOrderId: null,
      salesOrderId: null,
    })
    const view = await withStore(app, id, (tx) => loadPlanView(tx, id, env, NOV_RUN))
    expect(view.unpaidFees).toBe(20_000)
  })

  it('a fee already paid on its own link is not billed again', async () => {
    const env = await billingEnv()
    const id = await storeWithFeeBill(env)
    const [fee] = await rows(id)
    await owner
      .update(order)
      .set({ paymentStatus: 'paid' })
      .where(eq(order.id, fee?.salesOrderId as string))
    await runBillingSweep(app, env, NOV_RUN)
    expect(await lineUnits(await duePlanOrder())).toEqual([49_900])
    expect((await rows(id))[0]?.status).toBe('paid')
    const [old] = await owner
      .select({ status: order.status })
      .from(order)
      .where(eq(order.id, fee?.salesOrderId as string))
    expect(old?.status).not.toBe('cancelled')
  })

  it('two sweeps at once place one fee order', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
    await seedOrders(owner, id, ordersFrom(60, new Date('2026-10-05T06:00:00Z'), 2_00_000))
    await Promise.all([runUsageBilling(app, env, NOV_RUN), runUsageBilling(app, env, NOV_RUN)])
    const feeOrders = await owner
      .select({ id: order.id })
      .from(order)
      // Only fee bills are placed on the sales store in this test.
      .where(eq(order.storeId, env.salesStoreId as string))
    expect(feeOrders).toHaveLength(1)
    expect(await rows(id)).toHaveLength(1)
  })

  it('a missing fee product never blocks the renewal', async () => {
    const env = await billingEnv(['usage-fee-carried'])
    const id = await storeWithFeeBill(env)
    await runBillingSweep(app, env, NOV_RUN)
    expect(await lineUnits(await duePlanOrder())).toEqual([49_900])
    expect((await rows(id))[0]?.status).toBe('due')
  })

  it('hides months with nothing to pay from the bills list', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
    await seedOrders(owner, id, ordersFrom(10, new Date('2026-10-05T06:00:00Z')))
    await runUsageBilling(app, env, NOV_RUN)
    expect(await rows(id)).toHaveLength(1)
    const view = await withStore(app, id, (tx) => loadPlanView(tx, id, env, NOV_RUN))
    expect(view.usageBills).toEqual([])
  })

  it('reminds about an unpaid fee bill after 3 and 7 days, then stops', async () => {
    const env = await billingEnv()
    const id = await storeWithFeeBill(env)
    const day = (n: number) => new Date(NOV_RUN.getTime() + n * 86_400_000)
    expect((await runUsageReminders(app, env, day(1))).reminded).toBe(0)
    expect((await runUsageReminders(app, env, day(3))).reminded).toBe(1)
    expect((await runUsageReminders(app, env, day(4))).reminded).toBe(0)
    expect((await runUsageReminders(app, env, day(7))).reminded).toBe(1)
    expect((await runUsageReminders(app, env, day(20))).reminded).toBe(0)
    expect((await rows(id))[0]?.remindersSent).toBe(2)
  })
})
