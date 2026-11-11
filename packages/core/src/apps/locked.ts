/** SOURCE OF TRUTH: lockStoreApps
 * WHAT:  The store's `apps` record read under a row lock, for code about to write it back.
 * WHY:   Fourteen services read the whole record, change their own part and save it all. Two at
 *        once lost one change: Delivery options vanished from Installed apps on Waimers
 *        (10 Nov 2026). Locked, the second writer waits and reads the first one's change.
 * WHERE: Every `update(store).set({ apps })`; plain reads keep `parseAppsSettings`. The
 *        `store-apps-writes` sweep fails a file that writes `apps` without calling this (#1523).
 */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { type AppsSettings, parseAppsSettings } from './settings'

/** Reads `store.apps` FOR UPDATE; the lock holds until the transaction ends. */
export async function lockStoreApps(tx: StoreTx, storeId: string): Promise<AppsSettings> {
  const [s] = await tx
    .select({ apps: store.apps })
    .from(store)
    .where(eq(store.id, storeId))
    .for('update')
  return parseAppsSettings(s?.apps)
}
