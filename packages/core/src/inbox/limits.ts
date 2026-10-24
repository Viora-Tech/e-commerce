/** SOURCE OF TRUTH: INBOX_LIMITS, checkInboxLimits — WHAT: Inbox's rate limits (new conversations per IP, messages and images per conversation, staff messages per member), every key scoped to the store / WHY: one store's spam flood stays in that store's buckets and never slows another store's inbox (design §7). */
import {
  checkRateLimit,
  type RateLimitResult,
  type RateLimitRule,
  type RateLimitStore,
  rateLimitKey,
} from '../rate-limit/limiter'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const INBOX_LIMITS = {
  /** New conversations from one IP. */
  newConversationPerIp: { limit: 5, windowMs: HOUR },
  /** A shopper's messages in one conversation. */
  messagesPerMinute: { limit: 10, windowMs: MINUTE },
  messagesPerHour: { limit: 60, windowMs: HOUR },
  /** A shopper's images in one conversation. */
  imagesPerHour: { limit: 5, windowMs: HOUR },
  /** One staff member's messages, across conversations. */
  staffPerMinute: { limit: 60, windowMs: MINUTE },
} satisfies Record<string, RateLimitRule>

export type InboxLimit = keyof typeof INBOX_LIMITS

/** Largest image a shopper or staff member may send. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** `ratelimit:inbox-<rule>:<storeId>:<id>`: the store is always part of the key. */
export const inboxLimitKey = (rule: InboxLimit, storeId: string, id: string): string =>
  rateLimitKey(`inbox-${rule}`, `${storeId}:${id}`)

export type InboxLimitCheck = { rule: InboxLimit; id: string }

export type InboxLimitResult =
  | { ok: true }
  | { ok: false; rule: InboxLimit; result: RateLimitResult }

/**
 * Counts one hit against every rule and reports the first one over its limit. Every rule is
 * hit (not stopped at the first refusal), so a flood keeps filling each window.
 */
export async function checkInboxLimits(
  store: RateLimitStore,
  storeId: string,
  checks: InboxLimitCheck[],
  now: number = Date.now(),
): Promise<InboxLimitResult> {
  let refused: InboxLimitResult = { ok: true }
  for (const c of checks) {
    const result = await checkRateLimit(
      store,
      inboxLimitKey(c.rule, storeId, c.id),
      INBOX_LIMITS[c.rule],
      now,
    )
    if (!result.ok && refused.ok) refused = { ok: false, rule: c.rule, result }
  }
  return refused
}

/** The rules one shopper message counts against. */
export function shopperMessageChecks(opts: {
  conversationId: string | null
  ipHash: string
  kind: 'text' | 'image'
}): InboxLimitCheck[] {
  if (!opts.conversationId) return [{ rule: 'newConversationPerIp', id: opts.ipHash }]
  const checks: InboxLimitCheck[] = [
    { rule: 'messagesPerMinute', id: opts.conversationId },
    { rule: 'messagesPerHour', id: opts.conversationId },
  ]
  if (opts.kind === 'image') checks.push({ rule: 'imagesPerHour', id: opts.conversationId })
  return checks
}
