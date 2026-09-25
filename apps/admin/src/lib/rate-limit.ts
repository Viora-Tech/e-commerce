import { loadEnv } from '@commerce/config'
import {
  checkRateLimit,
  createRedisRateLimitStore,
  type RateLimitResult,
  type RateLimitRule,
  rateLimitKey,
} from '@commerce/core'
import { sharedRedis } from '@commerce/queue'

const g = globalThis as unknown as {
  __adminRateLimitStore?: ReturnType<typeof createRedisRateLimitStore>
}

function store() {
  if (!g.__adminRateLimitStore) {
    g.__adminRateLimitStore = createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL))
  }
  return g.__adminRateLimitStore
}

/** Checks and records one attempt under `scope:id`. Same shape as the storefront's `rate-limit.ts`. */
export async function rateLimited(
  scope: string,
  id: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  return checkRateLimit(store(), rateLimitKey(scope, id), rule)
}
