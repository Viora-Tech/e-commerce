/** Hostname from a Host header: lowercased, port stripped, null if unusable. */
export function hostnameFromHeader(host: string | null): string | null {
  if (!host) return null
  const name = host.split(':')[0]?.trim().toLowerCase() ?? ''
  return name.length > 0 ? name : null
}

export type StoreResolverOptions = {
  lookup: (hostname: string) => Promise<string | null>
  ttlMs?: number
  now?: () => number
}

/**
 * Hostname → store id with an in-memory TTL cache. Misses are cached too, so an
 * unknown host cannot turn into a database query per request. Failures are not
 * cached: the next request retries.
 */
export function createStoreResolver(opts: StoreResolverOptions) {
  const ttlMs = opts.ttlMs ?? 60_000
  const now = opts.now ?? Date.now
  const cache = new Map<string, { storeId: string | null; expiresAt: number }>()

  return async function resolve(hostname: string): Promise<string | null> {
    const hit = cache.get(hostname)
    if (hit && hit.expiresAt > now()) return hit.storeId
    const storeId = await opts.lookup(hostname)
    cache.set(hostname, { storeId, expiresAt: now() + ttlMs })
    return storeId
  }
}
