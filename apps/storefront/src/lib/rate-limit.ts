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
  __rateLimitStore?: ReturnType<typeof createRedisRateLimitStore>
}

function store() {
  if (!g.__rateLimitStore) {
    g.__rateLimitStore = createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL))
  }
  return g.__rateLimitStore
}

/** Checks and records one attempt under `scope:id`. See `data/checkout.ts` / `data/account.ts` for the copy shown on a block. */
export async function rateLimited(
  scope: string,
  id: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  return checkRateLimit(store(), rateLimitKey(scope, id), rule)
}

export { clientIp, retryAfterSeconds } from '@commerce/core'
