import {
  checkRateLimit,
  createMemoryRateLimitStore,
  type RateLimitRule,
  type RateLimitStore,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import { ORPCError, os } from '@orpc/server'

/**
 * Per-store rate limits on the admin actions that cost the most (noisy neighbour, the
 * request side; the worker side is `fairProcessor` in `@commerce/queue`). Each kind is
 * one shared bucket per store, so ten import buttons are still one import budget, and
 * one store hammering "Export" never slows another store's admin.
 *
 * The budgets are generous for a person clicking and tight for a script: a merchant never
 * meets them in normal use. Imports are counted twice per run (preview, then import or
 * start), so 20 an hour is about ten imports.
 */
export type HeavyAction = 'import' | 'bulk' | 'export' | 'storeData'

export const HEAVY_ACTION_RULES: Record<HeavyAction, RateLimitRule> = {
  import: { limit: 20, windowMs: 60 * 60_000 },
  bulk: { limit: 60, windowMs: 10 * 60_000 },
  export: { limit: 30, windowMs: 10 * 60_000 },
  /** A full store export (every table plus files) or a store delete. */
  storeData: { limit: 5, windowMs: 60 * 60_000 },
}

/** Same in-process fallback as the other routers, for hosts that wire no shared store. */
const fallback = createMemoryRateLimitStore()

type HeavyContext = {
  rateLimit?: RateLimitStore | undefined
  scope: { storeId: string }
}

/**
 * `can(permission).use(heavy('bulk'))`: refuses with TOO_MANY_REQUESTS (and a plain
 * "try again in N minutes") once the store has used its budget for that kind of action.
 */
export function heavy(action: HeavyAction) {
  return os.$context<HeavyContext>().middleware(async ({ context, next }) => {
    const limit = await checkRateLimit(
      context.rateLimit ?? fallback,
      rateLimitKey(`heavy:${action}`, context.scope.storeId),
      HEAVY_ACTION_RULES[action],
    )
    if (!limit.ok) {
      const minutes = Math.max(1, Math.ceil(retryAfterSeconds(limit) / 60))
      throw new ORPCError('TOO_MANY_REQUESTS', {
        message: `Your store has done this a lot in a short time. Try again in about ${minutes} minute(s).`,
        data: { action, retryAfterSeconds: retryAfterSeconds(limit) },
      })
    }
    return next()
  })
}
