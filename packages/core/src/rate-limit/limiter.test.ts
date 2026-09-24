import { describe, expect, it } from 'vitest'
import { checkRateLimit, rateLimitKey, retryAfterSeconds } from './limiter'
import { createMemoryRateLimitStore } from './memory-store'
import { createRedisRateLimitStore, type RedisLike } from './redis-store'

describe('checkRateLimit with the in-memory store', () => {
  it('allows up to the limit inside the window, then blocks', async () => {
    const store = createMemoryRateLimitStore()
    const rule = { limit: 3, windowMs: 60_000 }
    let now = 0
    for (let i = 0; i < 3; i += 1) {
      const r = await checkRateLimit(store, 'k', rule, now)
      expect(r.ok).toBe(true)
      now += 1_000
    }
    const blocked = await checkRateLimit(store, 'k', rule, now)
    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('a fake clock advancing past the window lets the key recover', async () => {
    const store = createMemoryRateLimitStore()
    const rule = { limit: 1, windowMs: 10_000 }
    expect((await checkRateLimit(store, 'k', rule, 0)).ok).toBe(true)
    // Still inside the first hit's window: blocked, and this attempt is
    // itself now recorded as a second hit.
    expect((await checkRateLimit(store, 'k', rule, 1_000)).ok).toBe(false)
    // Past the window for both earlier hits: recovers.
    expect((await checkRateLimit(store, 'k', rule, 20_000)).ok).toBe(true)
  })

  it('keys are independent (per email, per IP, per cart all isolate)', async () => {
    const store = createMemoryRateLimitStore()
    const rule = { limit: 1, windowMs: 60_000 }
    const a = rateLimitKey('otp:email', 'a@example.com')
    const b = rateLimitKey('otp:email', 'b@example.com')
    expect((await checkRateLimit(store, a, rule, 0)).ok).toBe(true)
    expect((await checkRateLimit(store, a, rule, 0)).ok).toBe(false)
    expect((await checkRateLimit(store, b, rule, 0)).ok).toBe(true)
  })

  it('retryAfterSeconds rounds up and is never zero once blocked', async () => {
    const store = createMemoryRateLimitStore()
    const rule = { limit: 1, windowMs: 10_000 }
    await checkRateLimit(store, 'k', rule, 0)
    const blocked = await checkRateLimit(store, 'k', rule, 9_500)
    expect(retryAfterSeconds(blocked)).toBeGreaterThanOrEqual(1)
  })
})

describe('createRedisRateLimitStore', () => {
  /** A fake ioredis pipeline: records the zadd/zrange/zcard args, replays canned replies. */
  function fakePipeline(replies: unknown[]) {
    const calls: string[] = []
    const chain = {
      zremrangebyscore: (...a: unknown[]) => {
        calls.push(`zremrangebyscore:${JSON.stringify(a)}`)
        return chain
      },
      zadd: (...a: unknown[]) => {
        calls.push(`zadd:${JSON.stringify(a)}`)
        return chain
      },
      zrange: (...a: unknown[]) => {
        calls.push(`zrange:${JSON.stringify(a)}`)
        return chain
      },
      zcard: (...a: unknown[]) => {
        calls.push(`zcard:${JSON.stringify(a)}`)
        return chain
      },
      pexpire: (...a: unknown[]) => {
        calls.push(`pexpire:${JSON.stringify(a)}`)
        return chain
      },
      exec: async () => replies.map((r) => [null, r] as [Error | null, unknown]),
    }
    return { chain, calls }
  }

  it('reads the count and oldest hit timestamp out of the pipeline reply', async () => {
    const { chain } = fakePipeline([
      0, // zremrangebyscore
      1, // zadd
      ['1000-ab12cd', '1000'], // zrange 0 0 WITHSCORES -> [member, score]
      2, // zcard
      'OK', // pexpire
    ])
    const redis: RedisLike = { pipeline: () => chain }
    const store = createRedisRateLimitStore(redis)
    const result = await store.hit('ratelimit:test:k', 60_000, 1_500)
    expect(result).toEqual({ count: 2, oldestMs: 1000 })
  })

  it('falls back to now when the pipeline reply is empty', async () => {
    const { chain } = fakePipeline([0, 1, [], 1, 'OK'])
    const redis: RedisLike = { pipeline: () => chain }
    const store = createRedisRateLimitStore(redis)
    const result = await store.hit('ratelimit:test:k', 60_000, 42)
    expect(result).toEqual({ count: 1, oldestMs: 42 })
  })
})
