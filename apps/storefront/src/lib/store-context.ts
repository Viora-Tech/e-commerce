import 'server-only'
import { setRequestMemo } from '@commerce/core/request-memo'
import { type StoreTx, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { cache } from 'react'
import { db } from './db'
import { requestCatalogId } from './market-catalog'

/**
 * Reads repeated within one render (the store's `apps` record, the live theme, a store-cache
 * read while caching is off) answer once per request: React scopes `cache` to one server
 * render, so nothing here outlives it, and actions and route handlers get a fresh map per call.
 * See `@commerce/core/request-memo`. `STOREFRONT_REQUEST_MEMO=0` turns it off (to compare, or as
 * a kill switch).
 */
if (process.env.STOREFRONT_REQUEST_MEMO !== '0') {
  setRequestMemo(cache(() => new Map<string, Promise<unknown>>()))
}

/** `STOREFRONT_TX_LOG=1`: logs each transaction a render opens, numbered, to count them. */
const TX_LOG = process.env.STOREFRONT_TX_LOG === '1'
const txCount = cache(() => ({ request: Math.random().toString(36).slice(2, 8), n: 0 }))

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
  if (TX_LOG) {
    const count = txCount()
    count.n += 1
    const at = new Error().stack?.split('\n').slice(2, 5).join(' <- ').trim()
    logger.info('storefront transaction', { storeId, request: count.request, n: count.n, at })
  }
  return withStore(db(), storeId, (tx) => fn(tx, storeId), { catalogId })
}
