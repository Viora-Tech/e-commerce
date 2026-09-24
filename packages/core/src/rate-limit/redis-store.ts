import type { RateLimitHit, RateLimitStore } from './limiter'

/**
 * The slice of ioredis's pipeline API this store needs, so core never
 * depends on ioredis itself; the connection apps already create with
 * `@commerce/queue` satisfies this structurally.
 */
export type RedisPipeline = {
  zremrangebyscore(key: string, min: number | string, max: number | string): RedisPipeline
  zadd(key: string, score: number, member: string): RedisPipeline
  zrange(key: string, start: number, stop: number, withScores: 'WITHSCORES'): RedisPipeline
  zcard(key: string): RedisPipeline
  pexpire(key: string, ms: number): RedisPipeline
  exec(): Promise<[Error | null, unknown][] | null>
}

export type RedisLike = {
  pipeline(): RedisPipeline
}

/**
 * One sorted set per key: member per hit (timestamp plus a random suffix so
 * two hits in the same millisecond never collide), score is the hit's
 * timestamp. Every call trims entries older than the window, records this
 * hit, reads the oldest surviving one and the count, and refreshes the key's
 * TTL to the window so an idle key frees itself.
 */
export function createRedisRateLimitStore(redis: RedisLike): RateLimitStore {
  return {
    async hit(key, windowMs, now): Promise<RateLimitHit> {
      const member = `${now}-${Math.random().toString(36).slice(2, 8)}`
      const results = await redis
        .pipeline()
        .zremrangebyscore(key, 0, now - windowMs)
        .zadd(key, now, member)
        .zrange(key, 0, 0, 'WITHSCORES')
        .zcard(key)
        .pexpire(key, windowMs)
        .exec()
      const oldest = results?.[2]?.[1] as string[] | undefined
      const count = (results?.[3]?.[1] as number | undefined) ?? 1
      const oldestMs = oldest && oldest.length >= 2 ? Number(oldest[1]) : now
      return { count, oldestMs: Number.isFinite(oldestMs) ? oldestMs : now }
    },
  }
}
