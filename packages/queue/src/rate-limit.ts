import {
  checkRateLimit,
  createRedisRateLimitStore,
  type RateLimitResult,
  type RateLimitRule,
  rateLimitKey,
} from '@commerce/core'
import { sharedRedis } from './index'

const g = globalThis as unknown as {
  __commerceRateLimitStore?: ReturnType<typeof createRedisRateLimitStore>
}

/**
 * SOURCE OF TRUTH KEYWORDS: redisRateLimiter, rateLimited, __commerceRateLimitStore
 * WHAT:  A `rateLimited(scope, id, rule)` checker on the process's shared Redis connection;
 *        checks and records one attempt under `scope:id`.
 * WHY:   Admin and storefront each built the same lazily created store; one copy here.
 *        The URL is read on first use, not at import, so `next build` needs no Redis.
 * WHERE: apps/admin and apps/storefront `lib/rate-limit.ts` (their `server-only` doors);
 *        limiter maths in `@commerce/core` rate-limit.
 */
export function redisRateLimiter(redisUrl: () => string) {
  const store = () => {
    if (!g.__commerceRateLimitStore) {
      g.__commerceRateLimitStore = createRedisRateLimitStore(sharedRedis(redisUrl()))
    }
    return g.__commerceRateLimitStore
  }
  return (scope: string, id: string, rule: RateLimitRule): Promise<RateLimitResult> =>
    checkRateLimit(store(), rateLimitKey(scope, id), rule)
}
