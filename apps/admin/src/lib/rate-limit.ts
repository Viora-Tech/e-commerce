import 'server-only'
import { loadEnv } from '@commerce/config'
import { redisRateLimiter } from '@commerce/queue'

/** Checks and records one attempt under `scope:id` (owner: `redisRateLimiter` in `@commerce/queue`). */
export const rateLimited = redisRateLimiter(() => loadEnv(process.env).REDIS_URL)
