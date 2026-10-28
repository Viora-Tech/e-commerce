/** SOURCE OF TRUTH: monthly usage bill tests — WHAT: the 1st's per-order fee bill, carry-forward, pay and cancel / WHY: a store must be billed once, only for real orders in paid time */
import { createDb, order, orderLine, storePlan, usageBill } from '@commerce/db'
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
import { type BillingEnv, cancelUsageBill, markUsageBillPaid, runUsageBilling } from './service'

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

async function billingEnv(): Promise<BillingEnv> {
  return {
    salesStoreId: await seedSalesStore(owner),
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
