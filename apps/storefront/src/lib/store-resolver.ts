/** Hostname from a Host header: lowercased, port stripped, null if unusable. */
export function hostnameFromHeader(host: string | null): string | null {
  if (!host) return null
  const name = host.split(':')[0]?.trim().toLowerCase() ?? ''
  return name.length > 0 ? name : null
}

export type StoreResolverOptions<T> = {
  lookup: (hostname: string) => Promise<T | null>
  ttlMs?: number
  now?: () => number
}

/**
 * Hostname → routing answer (a store id, or the host route with its primary
 * domain) with an in-memory TTL cache. Misses are cached too, so an unknown
 * host cannot turn into a database query per request. Failures are not
 * cached: the next request retries.
 */
export function createStoreResolver<T = string>(opts: StoreResolverOptions<T>) {
  const ttlMs = opts.ttlMs ?? 60_000
  const now = opts.now ?? Date.now
  const cache = new Map<string, { value: T | null; expiresAt: number }>()

  return async function resolve(hostname: string): Promise<T | null> {
    const hit = cache.get(hostname)
    if (hit && hit.expiresAt > now()) return hit.value
    const value = await opts.lookup(hostname)
    cache.set(hostname, { value, expiresAt: now() + ttlMs })
    return value
  }
}
