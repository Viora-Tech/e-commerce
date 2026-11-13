/** SOURCE OF TRUTH: the checkout layout and sidebar count tests — WHAT: a store that never chose keeps `fixed` (no `layout` in its config, so its config version is unchanged), saving `list` reaches the engine's config without touching the Protect card, and the app bar counts options and rules / WHY: the Options page's Courier list (Figma 938:12101) changes the live checkout only when the merchant chooses it. */
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deliveryOptionsAppBar } from './app-bar'
import { PRESET_OPTIONS } from './config'
import {
  loadDeliveryConfig,
  saveDeliveryLayout,
  saveDeliveryOption,
  saveProtectCard,
  saveRouteRule,
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

async function newStore(): Promise<string> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'w', name: 'Waimers', apps: { installed: ['delivery-options'] } })
    .returning()
  return s?.id as string
}

describe('checkout layout', () => {
  it('is fixed until chosen, and the list layout keeps the Protect card', async () => {
    const storeId = await newStore()
    const before = await withStore(app, storeId, async (tx) => {
      await saveDeliveryOption(tx, storeId, null, PRESET_OPTIONS[0])
      await saveProtectCard(tx, storeId, { ratesBps: { electronics: 50 } })
      return loadDeliveryConfig(tx, storeId)
    })
    expect(before.layout).toBeUndefined()
    const after = await withStore(app, storeId, async (tx) => {
      await saveDeliveryLayout(tx, storeId, 'list')
      return loadDeliveryConfig(tx, storeId)
    })
    expect(after.layout).toBe('list')
    expect(after.protect).toEqual(before.protect)
    expect(after.version).not.toBe(before.version)
    const back = await withStore(app, storeId, async (tx) => {
      await saveDeliveryLayout(tx, storeId, 'fixed')
      return loadDeliveryConfig(tx, storeId)
    })
    // Back to fixed is the same config as never choosing.
    expect(back.layout).toBeUndefined()
    expect(back.version).toBe(before.version)
  })
})

describe('app bar counts', () => {
  it('counts options and rules for members who can read settings', async () => {
    const storeId = await newStore()
    const counts = await withStore(app, storeId, async (tx) => {
      for (const preset of PRESET_OPTIONS) await saveDeliveryOption(tx, storeId, null, preset)
      await saveRouteRule(tx, storeId, null, {
        name: 'Glasspads',
        target: { kind: 'tags', values: ['glasspad'] },
        routes: [{ carrier: 'delhivery' }],
      })
      return {
        allowed: await deliveryOptionsAppBar({ tx, can: () => true }),
        denied: await deliveryOptionsAppBar({ tx, can: () => false }),
      }
    })
    expect(counts.allowed).toEqual({ pageCounts: { options: 2, rules: 1 } })
    expect(counts.denied).toBeNull()
  })
})
