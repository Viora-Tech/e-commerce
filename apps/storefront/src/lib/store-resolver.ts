import { LruCache } from './lru-cache'

/**
 * A Host header is a DNS name with an optional numeric port, nothing else. Anything more
 * (`shop.in:1@evil.com`, spaces, slashes) is refused: pages build absolute links from the
 * Host, and `new URL('https://shop.in:1@evil.com').origin` is `https://evil.com`.
 */
const HOST_HEADER =
  /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)(?::(\d{1,5}))?$/

/** Hostname and port from a Host header: lowercased, null if it is not a plain host[:port]. */
export function parseHostHeader(host: string | null): { hostname: string; port: string } | null {
  const match = HOST_HEADER.exec(host?.trim().toLowerCase() ?? '')
  if (!match?.[1] || match[1].length > 253) return null
  return { hostname: match[1], port: match[2] ?? '' }
}

/** Hostname from a Host header: lowercased, port stripped, null if unusable. */
export function hostnameFromHeader(host: string | null): string | null {
  return parseHostHeader(host)?.hostname ?? null
}

/**
 * The public origin for a validated Host header. `https` unless the proxy said `http`
 * (or, in dev with no header, `http`). Null when the Host is not a plain host[:port].
 */
export function originFromHost(
  host: string | null,
  forwardedProto: string | null,
  dev: boolean,
): { origin: string; hostname: string } | null {
  const parsed = parseHostHeader(host)
  if (!parsed) return null
  const proto = (forwardedProto ?? (dev ? 'http' : 'https')) === 'http' ? 'http' : 'https'
  const port = parsed.port ? `:${parsed.port}` : ''
  return { origin: `${proto}://${parsed.hostname}${port}`, hostname: parsed.hostname }
}

export type StoreResolverOptions<T> = {
  lookup: (hostname: string) => Promise<T | null>
  ttlMs?: number
  /** Most keys kept; the least recently used go first. Default `RESOLVER_MAX_ENTRIES`. */
  maxEntries?: number
  /**
   * The store a cached answer belongs to, so `forgetStore` can drop it when that store changes.
   * Null for an answer that belongs to no store (an unknown host): those are dropped on every
   * store's change, since a new domain may now answer for it.
   */
  storeOf?: (key: string, value: T | null) => string | null
  now?: () => number
}

/**
 * How many keys a resolver keeps. A bot sending random Host headers fills it with misses; the
 * least recently used go first, so real shops stay. 10k short keys is well under a megabyte.
 */
export const RESOLVER_MAX_ENTRIES = 10_000

export type StoreResolver<T> = {
  (key: string): Promise<T | null>
  /** Drops the answers that belong to `storeId`, and every miss (see `storeOf`). */
  forgetStore: (storeId: string) => void
  /** Drops every cached answer. */
  clear: () => void
  /** How many keys are cached (tests). */
  readonly size: number
}

/**
 * Hostname → routing answer (a store id, or the host route with its primary
 * domain) with an in-memory TTL cache. Misses are cached too, so an unknown
 * host cannot turn into a database query per request. Failures are not
 * cached: the next request retries. The cache is an LRU of at most `maxEntries`
 * keys, so random hosts cannot grow it without limit; expired answers are dropped
 * when read and age out of the LRU otherwise.
 */
export function createStoreResolver<T = string>(opts: StoreResolverOptions<T>): StoreResolver<T> {
  const ttlMs = opts.ttlMs ?? 60_000
  const maxEntries = Math.max(4, opts.maxEntries ?? RESOLVER_MAX_ENTRIES)
  const storeOf = opts.storeOf
  // Every entry costs 1, so the size budget is a count of keys.
  const cache = new LruCache<{ value: T | null }>({
    maxSize: maxEntries,
    ...(opts.now ? { now: opts.now } : {}),
  })

  const resolve = async (key: string): Promise<T | null> => {
    const hit = cache.get(key)
    if (hit) return hit.value
    const value = await opts.lookup(key)
    cache.set(key, { value }, 1, ttlMs)
    return value
  }
  return Object.defineProperties(resolve, {
    forgetStore: {
      value: (storeId: string) => {
        if (!storeOf) return cache.clear()
        cache.deleteWhere((key, entry) => {
          const owner = storeOf(key, entry.value)
          return owner === null || owner === storeId
        })
      },
    },
    clear: { value: () => cache.clear() },
    size: { get: () => cache.count },
  }) as StoreResolver<T>
}
