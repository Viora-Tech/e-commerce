import { appPurchase, createDb, store, storePlan, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { parseAppsSettings } from '../apps/settings'
import { markAppBillPaid, stopAppRenewal, storeAppAccess } from './app-service'
import { appAccess } from './apps'
import { addInterval } from './plans'
import { ensureStorePlan } from './service'

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

async function seedStore(plan: 'starter' | 'growth' | 'pro') {
  const [s] = await owner.insert(store).values({ slug: 'asha', name: 'Asha' }).returning()
  const id = s?.id as string
  await withStore(app, id, (tx) => ensureStorePlan(tx, id, t0))
  await owner.update(storePlan).set({ plan, status: 'active' }).where(eq(storePlan.storeId, id))
  return id
}

describe('appAccess', () => {
  it('is free for unpriced apps, included from its plan up, and for sale below it', () => {
    expect(appAccess('gst-invoices', 'starter', null, t0)).toEqual({ state: 'free' })
    expect(appAccess('reviews', 'growth', null, t0)).toEqual({ state: 'included', plan: 'growth' })
    expect(appAccess('reviews', 'starter', null, t0)).toEqual({
      state: 'buy',
      pricePaise: 199_00,
      includedFrom: 'growth',
    })
    const until = new Date(t0.getTime() + DAY)
    expect(appAccess('emi-pay-later', 'growth', { until, renews: true }, t0)).toEqual({
      state: 'bought',
      until,
      renews: true,
    })
    expect(appAccess('emi-pay-later', 'growth', { until: t0, renews: false }, t0).state).toBe('buy')
  })
})

describe('paid app bills', () => {
  it('paying installs the app for a month; stopping keeps it until the month ends', async () => {
    const id = await seedStore('starter')
    const orderId = '01a0e000-0000-7000-8000-0000000000a1'
    await owner.insert(appPurchase).values({
      storeId: id,
      pluginId: 'reviews',
      salesOrderId: orderId,
      salesOrderNumber: 7,
      amountPaise: 234_82,
      periodStart: t0,
      periodEnd: addInterval(t0, 'month'),
    })
    let access = await withStore(app, id, (tx) => storeAppAccess(tx, id, t0))
    expect(access.reviews?.state).toBe('buy')

    expect(await markAppBillPaid(app, orderId, t0)).toEqual({ storeId: id, pluginId: 'reviews' })
    const [s] = await owner.select({ apps: store.apps }).from(store).where(eq(store.id, id))
    expect(parseAppsSettings(s?.apps).installed).toContain('reviews')
    access = await withStore(app, id, (tx) => storeAppAccess(tx, id, t0))
    expect(access.reviews).toMatchObject({ state: 'bought', renews: true })

    await withStore(app, id, (tx) => stopAppRenewal(tx, id, 'reviews'))
    access = await withStore(app, id, (tx) => storeAppAccess(tx, id, t0))
    expect(access.reviews).toMatchObject({ state: 'bought', renews: false })
    const later = new Date(t0.getTime() + 40 * DAY)
    access = await withStore(app, id, (tx) => storeAppAccess(tx, id, later))
    expect(access.reviews?.state).toBe('buy')
  })
})
