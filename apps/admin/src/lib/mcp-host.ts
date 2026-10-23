import 'server-only'
import { loadEnv } from '@commerce/config'
import { createRedisRateLimitStore } from '@commerce/core'
import { sharedRedis } from '@commerce/queue'
import { apiHost } from './api'
import { db } from './db'

/**
 * What the MCP, OAuth and `/api/v1` routes run with. `origin` is the admin's public address:
 * the OAuth issuer and the base of every store's MCP address, so it must be what clients see.
 * `api` is what MCP `runAction` and its download links call admin procedures with.
 */
export function mcpHost() {
  const env = loadEnv(process.env)
  return {
    db: db(),
    rateLimit: createRedisRateLimitStore(sharedRedis(env.REDIS_URL)),
    origin: env.ADMIN_URL.replace(/\/$/, ''),
    api: apiHost,
  }
}
