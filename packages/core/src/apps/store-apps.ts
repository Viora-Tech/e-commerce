/** SOURCE OF TRUTH: storeAppsRow, storeAppsSettings
 * WHAT:  The store's `apps` record (and `storage`, which the registries read beside it) for a
 *        read-only lookup, read once per storefront request (`memoPerRequest`).
 * WHY:   The registries, the theme packs, Forms, Reviews, Chatwoot and the other apps each read
 *        this row; one storefront page read it 14 times.
 *
 * Code that changes the record reads it with `lockStoreApps` instead, never through here.
 */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { memoPerRequest } from '../request-memo'
import { type AppsSettings, parseAppsSettings } from './settings'

export type StoreAppsRow = { apps: unknown; storage: unknown }

/** The raw `apps` and `storage` columns; both undefined when the store row is not visible. */
export function storeAppsRow(tx: StoreTx, storeId: string): Promise<StoreAppsRow> {
  return memoPerRequest(`store-apps|${storeId}`, async () => {
    const [s] = await tx
      .select({ apps: store.apps, storage: store.storage })
      .from(store)
      .where(eq(store.id, storeId))
    return { apps: s?.apps, storage: s?.storage }
  })
}

/** The parsed `apps` record (a fresh object per call, so one caller's edits never reach another). */
export async function storeAppsSettings(tx: StoreTx, storeId: string): Promise<AppsSettings> {
  return parseAppsSettings((await storeAppsRow(tx, storeId)).apps)
}
