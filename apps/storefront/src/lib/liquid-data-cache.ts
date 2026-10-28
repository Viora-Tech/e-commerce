import 'server-only'
import type { LiquidDataSource, LiquidProductData } from '@commerce/core'
import { approxSize } from './lru-cache'
import { CACHE_TTL_MS, cachedForStore, peekForStore, rememberForStore } from './store-cache'

/**
 * An imported theme's data reads (`LiquidDataSource`) through the render cache: what one
 * section loaded, the next section, page and request reuse until the store changes. Keys carry
 * the origin, since `shop` and links are built from it, and the market's pricing, since a market
 * in another currency has its own prices (subfolder markets share the origin).
 */

/**
 * A batch read cached item by item: each key is looked up on its own (sharing the key the
 * single read uses), and only the ones not cached yet are loaded, together.
 */
async function cachedBatch<T>(
  storeId: string,
  keys: string[],
  cacheKey: (key: string) => string,
  load: (missing: string[]) => Promise<Map<string, T>>,
  empty: T | null,
): Promise<Map<string, T>> {
  const out = new Map<string, T>()
  const missing: string[] = []
  for (const key of keys) {
    const hit = await peekForStore<T | null>(storeId, cacheKey(key))
    if (hit === undefined) missing.push(key)
    else if (hit !== null) out.set(key, hit)
  }
  if (missing.length === 0) return out
  const loaded = await load(missing)
  for (const key of missing) {
    const found = loaded.get(key) ?? empty
    if (found !== null) out.set(key, found)
    await rememberForStore(storeId, cacheKey(key), found, {
      size: approxSize(found),
      ttlMs: CACHE_TTL_MS,
    })
  }
  return out
}

/** The theme's data source with every read cached per store version (the cart is not cached). */
export function cachedLiquidData(
  storeId: string,
  origin: string,
  source: LiquidDataSource,
  /** `pricingKey` of the page's market; '' for rupees. */
  pricing = '',
): LiquidDataSource {
  const prefix = `liquid-data|${origin}|${pricing ? `${pricing}|` : ''}`
  const read = <T>(key: string, load: () => Promise<T>) =>
    cachedForStore(storeId, `${prefix}${key}`, load)
  const { importedFiles, judgeme, products, collectionsProducts } = source
  return {
    ...source,
    product: (handle) => read(`p|${handle}`, () => source.product(handle)),
    products: products
      ? (handles) => cachedBatch(storeId, handles, (h) => `${prefix}p|${h}`, products, null)
      : undefined,
    collection: (handle) => read(`c|${handle}`, () => source.collection(handle)),
    collectionProducts: (handle, limit) =>
      read(`cp|${handle}|${limit}`, () => source.collectionProducts(handle, limit)),
    collectionsProducts: collectionsProducts
      ? (handles, limit) =>
          cachedBatch<LiquidProductData[]>(
            storeId,
            handles,
            (h) => `${prefix}cp|${h}|${limit}`,
            (missing) => collectionsProducts(missing, limit),
            [],
          )
      : undefined,
    collections: () => read('collections', () => source.collections()),
    relatedProducts: (productId, limit, intent = 'related') =>
      read(`rel|${productId}|${limit}|${intent}`, () =>
        source.relatedProducts(productId, limit, intent),
      ),
    menu: (handle) => read(`m|${handle}`, () => source.menu(handle)),
    blog: (handle) => read(`b|${handle}`, () => source.blog(handle)),
    page: (handle) => read(`pg|${handle}`, () => source.page(handle)),
    metafields: (ownerType, ownerIds) =>
      read(`mf|${ownerType}|${ownerIds.join(',')}`, () => source.metafields(ownerType, ownerIds)),
    metaobjectsOfType: (type) => read(`mt|${type}`, () => source.metaobjectsOfType(type)),
    metaobjects: (ids) => read(`mo|${ids.join(',')}`, () => source.metaobjects(ids)),
    importedFiles: importedFiles ? () => read('files', importedFiles) : undefined,
    judgeme: judgeme ? () => read('judgeme', judgeme) : undefined,
  }
}
