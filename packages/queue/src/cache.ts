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
