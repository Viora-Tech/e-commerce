import 'server-only'
import { loadEnv } from '@commerce/config'
import { listenStorefrontCache, nextScheduledChange } from '@commerce/core'
import { memoPerRequest, peekPerRequest, rememberPerRequest } from '@commerce/core/request-memo'
import type { StoreTx } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { cache } from 'react'
import { SOFT_DELAY_MS, StoreVersions } from './cache-versions'
import { scheduleWarm, WARM_QUIET_MS } from './cache-warm'
import { approxSize, LruCache } from './lru-cache'
import { requestCatalogId } from './market-catalog'
import { inStore } from './store-context'

/**
 * The storefront's render cache: store data and rendered theme sections, kept in this process
 * until the store changes. Postgres tells us (`storefront_cache` NOTIFY from a trigger on every
 * table a page renders, migration 0115), so a merchant's save, a stock change or a theme
 * publish shows on the next request. Every key carries the store's stamp (`cache-versions.ts`);
 * a new stamp leaves the old entries unread until the LRU drops them.
 *
 * Never cached: anything personal (cart, customer, checkout), and theme previews. Callers key
 * by everything their value depends on besides store data (the host, the path, the handle).
 * While the listener is down nothing is cached at all, so a missed notification never serves an
 * old page.
 */

/** Longest any entry lives, even with no write: a safety net for changes no trigger sees. */
export const CACHE_TTL_MS = 60 * 60_000

const DEFAULT_CACHE_MB = 48

type Shared = {
  versions: StoreVersions
  entries: LruCache<{ value: unknown }>
  inFlight: Map<string, Promise<unknown>>
  boundaries: Set<string>
  listening: boolean
}

// One cache per process: the app's server bundles (pages, route handlers) share it.
const g = globalThis as unknown as { __storefrontCache?: Shared }

function shared(): Shared {
  if (!g.__storefrontCache) {
    const mb = loadEnv(process.env).STOREFRONT_CACHE_MB ?? DEFAULT_CACHE_MB
    g.__storefrontCache = {
      versions: new StoreVersions(),
      entries: new LruCache({ maxSize: mb * 1024 * 1024 }),
      inFlight: new Map(),
      boundaries: new Set(),
      listening: mb === 0,
    }
  }
  const s = g.__storefrontCache
  if (!s.listening) {
    s.listening = true
    // LISTEN needs a connection of its own for good, so never through PgBouncer.
    const env = loadEnv(process.env)
    listenStorefrontCache(env.DATABASE_URL_DIRECT ?? env.DATABASE_URL, {
      onChange: (storeId, soft) => {
        s.versions.notify(storeId, soft)
        // Re-render the store's recent pages once the change has settled (a soft one applies
        // after its delay, so the warm waits for that too).
        if (soft) scheduleWarm(storeId, SOFT_DELAY_MS + WARM_QUIET_MS, false)
        else scheduleWarm(storeId)
      },
      onLive: () => s.versions.connected(),
      onLost: () => s.versions.disconnected(),
    })
  }
  return s
}

/**
 * Looks up the store's next scheduled change once per version (a launch ends the cache), in the
 * background: never awaited by a request, which may be holding a transaction of its own.
 */
function settleBoundary(s: Shared, storeId: string, stamp: string): void {
  const key = `${storeId}|${stamp}`
  if (s.boundaries.has(key)) return
  s.boundaries.add(key)
  inStore(storeId, (tx) => nextScheduledChange(tx))
    .then((at) => s.versions.setBoundary(storeId, stamp, at ? at.getTime() : null))
    .catch((err) => logger.error('scheduled change lookup failed', { storeId, error: err }))
    .finally(() => s.boundaries.delete(key))
}

/**
 * The store's stamp for this request (one per request, so a page never mixes two versions), or
 * null when caching is off. Right after a change, until the store's next scheduled change is
 * known (a few milliseconds), it is null too: nothing is cached that could outlive a launch.
 */
export const storeStamp = cache(async (storeId: string): Promise<string | null> => {
  const s = shared()
  const stamp = s.versions.stamp(storeId)
  if (!stamp || !s.versions.needsBoundary(storeId)) return stamp
  settleBoundary(s, storeId, stamp)
  return null
})

export type CacheOptions = {
  ttlMs?: number
  /** Size to charge the budget, when walking the value (`approxSize`) would be wasted work. */
  size?: number
}

/** The key a value lives under for the rest of this request, while the store has no stamp. */
const requestKey = (storeId: string, key: string) => `store-cache|${storeId}|${key}`

/**
 * `load()` once per store version for `key`. Concurrent requests for the same key share one
 * load. Values are shared between requests: treat them as read-only. With no stamp (caching
 * off, or just after a change) nothing is kept across requests, but one render still loads each
 * key once (`memoPerRequest`), so a page that repeats a read does not repeat the query.
 */
export async function cachedForStore<T>(
  storeId: string,
  key: string,
  load: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const stamp = await storeStamp(storeId)
  if (!stamp) return memoPerRequest(requestKey(storeId, key), load)
  const s = shared()
  const full = `${storeId}|${stamp}|${key}`
  const hit = s.entries.get(full)
  if (hit) return hit.value as T
  const flying = s.inFlight.get(full)
  if (flying) return flying as Promise<T>
  const next = load()
    .then((value) => {
      s.entries.set(
        full,
        { value },
        options.size ?? approxSize(value),
        options.ttlMs ?? CACHE_TTL_MS,
      )
      return value
    })
    .finally(() => s.inFlight.delete(full))
  s.inFlight.set(full, next)
  return next
}

/** A cached read under the store's RLS: the transaction opens only on a miss. */
export function storeRead<T>(
  storeId: string,
  key: string,
  read: (tx: StoreTx) => Promise<T>,
  options?: CacheOptions,
): Promise<T> {
  return requestCatalogId(storeId).then((catalogId) =>
    // A market's catalog changes what a read lists: its rows are cached apart.
    cachedForStore(
      storeId,
      catalogId ? `${key}|catalog:${catalogId}` : key,
      () => inStore(storeId, read),
      options,
    ),
  )
}

/** A cached value, if there is one (`cachedForStore` stores it); no load on a miss. */
export async function peekForStore<T>(storeId: string, key: string): Promise<T | undefined> {
  const stamp = await storeStamp(storeId)
  if (!stamp) return peekPerRequest<T>(requestKey(storeId, key))
  return shared().entries.get(`${storeId}|${stamp}|${key}`)?.value as T | undefined
}

/** Stores a value computed elsewhere (a rendered section) under the store's current stamp. */
export async function rememberForStore(
  storeId: string,
  key: string,
  value: unknown,
  options: Required<CacheOptions>,
): Promise<void> {
  const stamp = await storeStamp(storeId)
  if (!stamp) return rememberPerRequest(requestKey(storeId, key), value)
  shared().entries.set(`${storeId}|${stamp}|${key}`, { value }, options.size, options.ttlMs)
}
