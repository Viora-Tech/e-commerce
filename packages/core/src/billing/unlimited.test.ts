/** SOURCE OF TRUTH: unlimited store tests — WHAT: Koomerce's own store has no limits, fees or bills / WHY: Waimers must never be billed, paused or capped like a merchant */
import { aiSettings, createDb, planPayment, storePlan, withStore } from '@commerce/db'
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
  choosePlan,
  loadPlanView,
  runBillingSweep,
  runUsageBilling,
  UnlimitedPlan,
} from './service'
import { staffSeats } from './staff-seats'
import { storageRoom } from './storage-room'
import { setStoreUnlimited } from './unlimited'
import { feeEstimate } from './usage-fee-service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

// Midnight in India on 1 Oct and 1 Nov; half an hour into 1 Nov.
const OCT = new Date('2026-09-30T18:30:00Z')
const NOV = new Date('2026-10-31T18:30:00Z')
const NOV_RUN = new Date('2026-10-31T19:00:00Z')

async function billingEnv(): Promise<BillingEnv> {
  return {
    salesStoreId: await seedSalesStore(owner),
    settingsSecret: 'test-secret-test-secret-test-secret',
    salesStorefrontUrl: 'https://sales.example.test',
  }
}

describe('setStoreUnlimited', () => {
  it('lifts every limit, fee and bill, and caps AI at the internal tier', async () => {
    const env = await billingEnv()
    const id = await seedStore(owner, 'waimers')
    // A Starter store well past its 50 orders, with its period about to renew.
    await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
    await seedOrders(owner, id, ordersFrom(80, new Date('2026-10-05T06:00:00Z'), 2_00_000))

    expect(await setStoreUnlimited(owner, 'waimers', true)).toMatchObject({ storeId: id })
    const [plan] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(plan).toMatchObject({ unlimited: true, plan: 'scale', status: 'active' })
    const [ai] = await owner.select().from(aiSettings).where(eq(aiSettings.storeId, id))
    expect(ai?.plan).toBe('internal')

    await withStore(app, id, async (tx) => {
      expect((await staffSeats(tx, id)).limit).toBeNull()
      expect((await storageRoom(tx, id)).limitBytes).toBeNull()
      expect((await feeEstimate(tx, id, new Date('2026-10-20T06:00:00Z'))).feePaise).toBe(0)
      expect((await loadPlanView(tx, id, env, NOV_RUN)).unlimited).toBe(true)
    })

    // No fee bill for October, no renewal bill, never made due or paused.
    const usage = await runUsageBilling(app, env, NOV_RUN)
    expect(usage.billed).toBe(0)
    const sweep = await runBillingSweep(app, env, new Date(NOV.getTime() + 30 * 86_400_000))
    expect(sweep).toMatchObject({ billed: 0, due: 0, paused: 0 })
    const bills = await owner.select().from(planPayment).where(eq(planPayment.storeId, id))
    expect(bills.filter((b) => b.status === 'due')).toHaveLength(0)
    const [after] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(after?.status).toBe('active')

    await expect(choosePlan(app, id, { plan: 'pro', interval: 'month' }, env)).rejects.toThrow(
      UnlimitedPlan,
    )
  })

  it('switches off back to Scale AI, and knows no unknown store', async () => {
    const id = await seedStore(owner, 'waimers')
    await setStoreUnlimited(owner, 'waimers', true)
    await setStoreUnlimited(owner, 'waimers', false)
    const [plan] = await owner.select().from(storePlan).where(eq(storePlan.storeId, id))
    expect(plan?.unlimited).toBe(false)
    const [ai] = await owner.select().from(aiSettings).where(eq(aiSettings.storeId, id))
    expect(ai?.plan).toBe('scale')
    expect(await setStoreUnlimited(owner, 'nobody', true)).toBeNull()
  })
})
