/** SOURCE OF TRUTH: checkStoreSes tests — WHAT: the saved SES app (decrypted) is what gets checked; no app, nothing to check; a broken saved config reads as wrong keys / WHY: the Connect page's after-save check must test the keys the store will really send with */
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { SesConfig } from '@commerce/notifications-ses'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { checkStoreSes } from './ses-check'
import { encryptNotificationSettings } from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-settings-secret-test-settings-secret'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed(ses: Record<string, string> | null) {
  const [s] = await owner.insert(store).values({ slug: 'ses-check', name: 'Waimers' }).returning()
  const storeId = s?.id as string
  if (ses) {
    const settings = encryptNotificationSettings(
      { enabled: ['ses'], providers: { ses }, recoverAbandoned: false, off: [] },
      SECRET,
    )
    await owner.update(store).set({ notifications: settings }).where(eq(store.id, storeId))
  }
  return storeId
}

describe('checkStoreSes', () => {
  it('checks the saved keys, decrypted', async () => {
    const storeId = await seed({
      region: 'ap-south-1',
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'shh-secret',
      fromEmail: 'orders@shop.example',
    })
    let seen: SesConfig | null = null
    const r = await withStore(app, storeId, (tx) =>
      checkStoreSes(tx, storeId, SECRET, [], async (config) => {
        seen = config
        return { errors: [], warnings: ['sandbox'] }
      }),
    )
    expect(r).toEqual({ errors: [], warnings: ['sandbox'] })
    expect(seen).toMatchObject({ secretAccessKey: 'shh-secret', fromEmail: 'orders@shop.example' })
  })

  it('has nothing to check without the app, and calls a broken config wrong keys', async () => {
    const none = await seed(null)
    expect(await withStore(app, none, (tx) => checkStoreSes(tx, none, SECRET))).toBeNull()
    await resetDb(owner)
    const broken = await seed({ region: 'ap-south-1', fromEmail: 'orders@shop.example' })
    expect(await withStore(app, broken, (tx) => checkStoreSes(tx, broken, SECRET))).toEqual({
      errors: ['bad_keys'],
      warnings: [],
    })
  })
})
