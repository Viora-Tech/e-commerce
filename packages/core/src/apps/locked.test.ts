/** SOURCE OF TRUTH: lockStoreApps tests — WHAT: two writers of store.apps at once both keep their change / WHY: Delivery options vanished from Installed apps when two writers raced (10 Nov 2026) */
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { saveStoreProfile } from '../settings/store-profile'
import { parseStoreTax } from '../tax/settings'
import { lockStoreApps } from './locked'
import { installApp, parseAppsSettings } from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('lockStoreApps', () => {
  it('makes a second writer wait and read the first one’s change, so neither is lost', async () => {
    const [s] = await owner
      .insert(store)
      .values({ slug: 'w', name: 'Waimers', apps: { installed: ['reviews'] } })
      .returning()
    const storeId = s?.id as string
    let releaseFirst: () => void = () => undefined
    const firstMayWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let firstLocked: () => void = () => undefined
    const lockedByFirst = new Promise<void>((resolve) => {
      firstLocked = resolve
    })

    const first = withStore(app, storeId, async (tx) => {
      const apps = await lockStoreApps(tx, storeId)
      firstLocked()
      await firstMayWrite
      await tx
        .update(store)
        .set({ apps: installApp(apps, 'delivery-options') })
        .where(eq(store.id, storeId))
    })
    await lockedByFirst
    // The second writer starts while the first holds the row; it must block on the lock.
    const second = withStore(app, storeId, async (tx) => {
      const apps = await lockStoreApps(tx, storeId)
      await tx
        .update(store)
        .set({ apps: installApp(apps, 'gst-invoices') })
        .where(eq(store.id, storeId))
    })
    await pause(300)
    releaseFirst()
    await Promise.all([first, second])

    const [row] = await owner.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
    expect(parseAppsSettings(row?.apps).installed).toEqual([
      'reviews',
      'delivery-options',
      'gst-invoices',
    ])
  })

  it('saving the store profile while an app installs keeps both (#1523)', async () => {
    const [s] = await owner
      .insert(store)
      .values({ slug: 'w2', name: 'Waimers', apps: { installed: ['reviews'] } })
      .returning()
    const storeId = s?.id as string
    let releaseFirst: () => void = () => undefined
    const firstMayWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let firstLocked: () => void = () => undefined
    const lockedByFirst = new Promise<void>((resolve) => {
      firstLocked = resolve
    })

    const install = withStore(app, storeId, async (tx) => {
      const apps = await lockStoreApps(tx, storeId)
      firstLocked()
      await firstMayWrite
      await tx
        .update(store)
        .set({ apps: installApp(apps, 'delivery-options') })
        .where(eq(store.id, storeId))
    })
    await lockedByFirst
    // Unlocked, this read the apps record before the install committed and wrote it back without it.
    const profile = withStore(app, storeId, (tx) =>
      saveStoreProfile({ tx, storeId }, { pricesIncludeGst: false }),
    )
    await pause(300)
    releaseFirst()
    await Promise.all([install, profile])

    const [row] = await owner.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
    expect(parseAppsSettings(row?.apps).installed).toEqual(['reviews', 'delivery-options'])
    expect(parseStoreTax(row?.apps).pricesIncludeGst).toBe(false)
  })
})
