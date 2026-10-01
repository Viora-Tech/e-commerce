import 'server-only'
import { loadEnv } from '@commerce/config'
import { redisRateLimiter } from '@commerce/queue'

/**
 * Checks and records one attempt under `scope:id` (owner: `redisRateLimiter` in
 * `@commerce/queue`). See `data/checkout.ts` / `data/account.ts` for the copy shown on a block.
 */
export const rateLimited = redisRateLimiter(() => loadEnv(process.env).REDIS_URL)

export { clientIp, retryAfterSeconds } from '@commerce/core'
