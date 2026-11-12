/** SOURCE OF TRUTH: concurrency leases — WHAT: "at most N at once" per key as expiring leases; `acquire` takes a slot (a token) or returns null when all N are held, `release` gives it back, and a slot never released (the worker crashed) frees itself after `leaseMs`. Redis store (one atomic script, shared by every worker copy) and an in-process store / WHY: a per-process counter capped each worker copy separately, so N copies allowed N times the limit. No new dependency: `RedisEvalLike` is a structural subset of the ioredis connection the worker already uses for BullMQ. Used by the automations HTTP action, wired in apps/worker. */

export type ConcurrencyStore = {
  /** A token for the slot taken, or null when `limit` unexpired leases already hold `key`. */
  acquire(key: string, limit: number, leaseMs: number, now: number): Promise<string | null>
  /** Frees the slot; a token that already expired or was released is a no-op. */
  release(key: string, token: string): Promise<void>
}

const newToken = (now: number) => `${now}-${Math.random().toString(36).slice(2, 10)}`

/**
 * One sorted set per key: member per lease, score is the lease's expiry. The script drops
 * expired leases, counts the rest and adds this one only when there is room, all in one
 * atomic step, so two copies racing the last slot cannot both get it.
 */
const ACQUIRE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) < tonumber(ARGV[2]) then
  redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  return 1
end
return 0
`

/** The slice of ioredis this store needs. */
export type RedisEvalLike = {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
  zrem(key: string, ...members: string[]): Promise<unknown>
}

export function createRedisConcurrencyStore(redis: RedisEvalLike): ConcurrencyStore {
  return {
    async acquire(key, limit, leaseMs, now) {
      const token = newToken(now)
      const got = await redis.eval(
        ACQUIRE_SCRIPT,
        1,
        key,
        now,
        limit,
        now + leaseMs,
        token,
        leaseMs,
      )
      return Number(got) === 1 ? token : null
    },
    async release(key, token) {
      await redis.zrem(key, token)
    },
  }
}

/**
 * In-process leases with the same expiry rules: a fake for tests, and the fallback when no
 * Redis store is passed. It only counts this process's calls, so never rely on it to cap
 * work spread across several processes.
 */
export function createMemoryConcurrencyStore(): ConcurrencyStore {
  const leases = new Map<string, Map<string, number>>()
  return {
    async acquire(key, limit, leaseMs, now) {
      const held = leases.get(key) ?? new Map<string, number>()
      for (const [t, expires] of held) if (expires <= now) held.delete(t)
      if (held.size >= limit) {
        leases.set(key, held)
        return null
      }
      const token = newToken(now)
      held.set(token, now + leaseMs)
      leases.set(key, held)
      return token
    },
    async release(key, token) {
      const held = leases.get(key)
      if (!held) return
      held.delete(token)
      if (held.size === 0) leases.delete(key)
    },
  }
}

/** Namespaces a concurrency key so unrelated caps never collide in one Redis. */
export const concurrencyKey = (scope: string, id: string): string => `concurrency:${scope}:${id}`
