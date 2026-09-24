import { checkRateLimit, createRedisRateLimitStore, rateLimitKey } from '@commerce/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConnection } from './index'

/**
 * Same limiter as `packages/core/src/rate-limit/limiter.test.ts`, against a
 * real Dragonfly/Redis instead of the in-memory fake, so the sorted-set
 * pipeline (`createRedisRateLimitStore`) is exercised for real.
 */
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const prefix = `test-${Date.now()}`
let redis: ReturnType<typeof createConnection>

beforeAll(() => {
  redis = createConnection(redisUrl)
})

afterAll(async () => {
  const keys = await redis.keys(`ratelimit:${prefix}:*`)
  if (keys.length) await redis.del(...keys)
  await redis.quit()
})

describe('rate limiter against Dragonfly', () => {
  it('allows up to the limit inside the window, then blocks, then recovers', async () => {
    const store = createRedisRateLimitStore(redis)
    const key = rateLimitKey(prefix, 'checkout-submit')
    const rule = { limit: 3, windowMs: 2_000 }

    for (let i = 0; i < 3; i += 1) {
      expect((await checkRateLimit(store, key, rule)).ok).toBe(true)
    }
    const blocked = await checkRateLimit(store, key, rule)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)

    await new Promise((resolve) => setTimeout(resolve, rule.windowMs + 100))
    expect((await checkRateLimit(store, key, rule)).ok).toBe(true)
  })

  it('keeps two keys (e.g. per email vs per IP) independent', async () => {
    const store = createRedisRateLimitStore(redis)
    const rule = { limit: 1, windowMs: 5_000 }
    const email = rateLimitKey(prefix, 'otp-email:a@example.com')
    const ip = rateLimitKey(prefix, 'otp-ip:203.0.113.1')

    expect((await checkRateLimit(store, email, rule)).ok).toBe(true)
    expect((await checkRateLimit(store, email, rule)).ok).toBe(false)
    expect((await checkRateLimit(store, ip, rule)).ok).toBe(true)
  })
})
