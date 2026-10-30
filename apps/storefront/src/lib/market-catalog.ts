import 'server-only'
import { type MarketCatalog, storeMarketCatalogs } from '@commerce/core'
import { withStore } from '@commerce/db'
import { headers } from 'next/headers'
import { cache } from 'react'
import { db } from './db'
import { MARKET_HEADERS } from './markets'
import { cachedForStore } from './store-cache'

/**
 * Markets › Catalogs on the storefront: the request's market's active catalog, read for every
 * market at once and cached per store version. `inStore` sets it on each transaction
 * (`app.catalog_id`) when it sells chosen products only, so every listing that adds
 * `soldInRequestCatalog` hides the rest; cache keys carry it (`storeRead`, the Liquid cache).
 */

/** This request's market id from the proxy's header; null outside a request or without one. */
export const requestMarketId = cache(async (): Promise<string | null> => {
  try {
    return (await headers()).get(MARKET_HEADERS.id)
  } catch {
    // Outside a request (a background warm, `after()`): no market, every product.
    return null
  }
})

/** The market's active catalog, or null (no catalog, or a draft one). */
export async function marketCatalogFor(
  storeId: string,
  marketId: string | null | undefined,
): Promise<MarketCatalog | null> {
  if (!marketId) return null
  // Read with `withStore` directly: `inStore` asks this function, so it must not be its caller.
  const all = await cachedForStore(storeId, 'market-catalogs', () =>
    withStore(db(), storeId, (tx) => storeMarketCatalogs(tx)),
  )
  return all.get(marketId) ?? null
}

/**
 * The catalog this request's listings are limited to: the market's active catalog when it sells
 * chosen products only; null everywhere else (India without a catalog, every product).
 */
export const requestCatalogId = cache(async (storeId: string): Promise<string | null> => {
  const found = await marketCatalogFor(storeId, await requestMarketId())
  return found?.chosen ? found.catalogId : null
})
