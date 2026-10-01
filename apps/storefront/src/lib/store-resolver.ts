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
