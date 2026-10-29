import type IORedis from 'ioredis'

/**
 * Tiny JSON cache on the same Dragonfly the queues use. Keys are namespaced
 * per store so one tenant's lookups never answer for another.
 */
export async function cacheGet<T>(redis: IORedis, key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function cacheSet(redis: IORedis, key: string, value: unknown, ttlSeconds: number) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // A cache miss is never an error; the caller just asks the courier again.
  }
}

/** Serviceability answers barely change; a day keeps courier calls to one per pincode. */
export const SERVICEABILITY_TTL_SECONDS = 24 * 3600

export const serviceabilityKey = (storeId: string, provider: string, pincode: string) =>
  `{shipping}:serviceability:${storeId}:${provider}:${pincode}`

/** Add one; the key expires `ttlSeconds` after its first count. */
export async function cacheIncr(redis: IORedis, key: string, ttlSeconds: number): Promise<number> {
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, ttlSeconds)
  return n
}

/** Newest first, keeping the latest `keep` entries. */
export async function cachePush(
  redis: IORedis,
  key: string,
  value: unknown,
  keep: number,
  ttlSeconds: number,
): Promise<void> {
  await redis
    .multi()
    .lpush(key, JSON.stringify(value))
    .ltrim(key, 0, keep - 1)
    .expire(key, ttlSeconds)
    .exec()
}

export async function cacheList<T>(redis: IORedis, key: string): Promise<T[]> {
  const raw = await redis.lrange(key, 0, -1)
  return raw.flatMap((r) => {
    try {
      return [JSON.parse(r) as T]
    } catch {
      return []
    }
  })
}

/**
 * The Delivery options app's courier cache on Redis: quotes (JSON), the circuit breaker
 * (counters) and each app's recent calls (a capped list). Matches `QuoteCache` in
 * `@commerce/core`; the storefront asks couriers with it and the admin reads health from it.
 */
export function deliveryQuoteCache(redis: IORedis) {
  return {
    get: <T>(key: string) => cacheGet<T>(redis, key),
    set: (key: string, value: unknown, ttl: number) => cacheSet(redis, key, value, ttl),
    incr: (key: string, ttl: number) => cacheIncr(redis, key, ttl),
    push: (key: string, value: unknown, keep: number, ttl: number) =>
      cachePush(redis, key, value, keep, ttl),
    list: <T>(key: string) => cacheList<T>(redis, key),
  }
}
