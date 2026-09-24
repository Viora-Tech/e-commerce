/**
 * A small Redis/Dragonfly-backed sliding-window rate limiter. No new
 * dependency: `RedisLike` is a structural subset of ioredis's pipeline API,
 * satisfied by the connection apps already create with `@commerce/queue`, so
 * core never depends on ioredis itself.
 *
 * Sliding window log (one Redis sorted set per key: member per hit, score is
 * the hit's timestamp): more accurate at the window boundary than a fixed
 * window counter, still O(1) round trips. Two callers can race the same key
 * (this is a pipeline, not a Lua script), so under heavy concurrency a
 * handful of extra requests can slip through right at the limit; the limits
 * below are generous enough that this does not matter, per the brief.
 */

export type RateLimitRule = {
  /** Requests allowed inside the window. */
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  /** 0 when `ok`; otherwise how long until the caller should retry. */
  retryAfterMs: number
}

export type RateLimitHit = {
  /** Hits still inside the trailing window, including this one. */
  count: number
  /** Timestamp of the oldest hit still inside the window (this one if it's the first). */
  oldestMs: number
}

export type RateLimitStore = {
  /** Records one hit for `key` and reports how many are still inside `windowMs`. */
  hit(key: string, windowMs: number, now: number): Promise<RateLimitHit>
}

/**
 * Check and record one attempt against `key`. Call once per attempt (send an
 * OTP, submit checkout, hit the webhook); do not call speculatively, since
 * every call counts as a hit.
 */
export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const { count, oldestMs } = await store.hit(key, rule.windowMs, now)
  const ok = count <= rule.limit
  const retryAfterMs = ok ? 0 : Math.max(0, rule.windowMs - (now - oldestMs))
  return { ok, limit: rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterMs }
}

/** Seconds for a `Retry-After` header, rounded up so the client never retries early. */
export const retryAfterSeconds = (result: RateLimitResult): number =>
  Math.max(1, Math.ceil(result.retryAfterMs / 1000))

/** Namespaces a limiter key so unrelated rules (and unrelated apps) never collide in one store. */
export const rateLimitKey = (scope: string, id: string): string => `ratelimit:${scope}:${id}`
