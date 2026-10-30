import 'server-only'
import { type StoreTx, withStore } from '@commerce/db'
import { db } from './db'
import { requestCatalogId } from './market-catalog'

/**
 * Run a query scoped to one store. Pages receive `storeId` as a route param
 * because the proxy rewrote the request under `/-s/[storeId]`; they never pick
 * a store themselves. Keeping the id in params (not headers) lets `use cache`
 * key on it later. A market selling from a catalog of chosen products also sets
 * `app.catalog_id`, so the storefront's listings show only those (`lib/market-catalog.ts`).
 */
export async function inStore<T>(
  storeId: string,
  fn: (tx: StoreTx, storeId: string) => Promise<T>,
): Promise<T> {
  const catalogId = await requestCatalogId(storeId)
  return withStore(db(), storeId, (tx) => fn(tx, storeId), { catalogId })
}
