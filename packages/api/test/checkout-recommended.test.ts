/**
 * Settings → Checkout → Recommended way to pay (#1173): the choice is saved on
 * `store.preferences.checkout` without touching other preferences, and the page lists the ways
 * to pay that are switched on. The save stays `can(SETTINGS_MANAGE)` (router-permissions sweep).
 * Only the test DB is touched.
 */
import {
  CheckoutSettingsSchema,
  loadCheckoutSettings,
  RECOMMENDED_METHOD,
  saveCheckoutSettings,
} from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

async function makeStore(slug: string, values: Partial<typeof store.$inferInsert> = {}) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: 'Waimers', ...values })
    .returning()
  return s?.id as string
}

const save = (storeId: string, recommendedMethod: string) =>
  withStore(app, storeId, (tx) =>
    saveCheckoutSettings(
      { tx, storeId },
      { settings: CheckoutSettingsSchema.parse({ recommendedMethod }) },
    ),
  )

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('recommended way to pay', () => {
  it('defaults to automatic for a store that never chose', async () => {
    const storeId = await makeStore('rec-default')
    const view = await withStore(app, storeId, (tx) => loadCheckoutSettings({ tx, storeId }))
    expect(view.settings.recommendedMethod).toBe(RECOMMENDED_METHOD.automatic)
  })

  it('saves a way to pay, and none, keeping the other preferences', async () => {
    const storeId = await makeStore('rec-save', { preferences: { seo: { title: 'Kept' } } })
    expect((await save(storeId, 'cod')).settings.recommendedMethod).toBe('cod')
    expect((await save(storeId, RECOMMENDED_METHOD.none)).settings.recommendedMethod).toBe('none')
    const [row] = await owner
      .select({ preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    expect(row?.preferences).toMatchObject({
      seo: { title: 'Kept' },
      checkout: { recommendedMethod: 'none' },
    })
  })

  it('lists only the ways to pay that are switched on', async () => {
    const storeId = await makeStore('rec-methods', {
      payments: {
        enabled: ['cod', 'razorpay', 'manual'],
        providers: {},
        inactive: { razorpay: ['razorpay'] },
      },
    })
    const view = await withStore(app, storeId, (tx) => loadCheckoutSettings({ tx, storeId }))
    expect(view.paymentMethods).toEqual(['cod', 'manual'])
  })
})
