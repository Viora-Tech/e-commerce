import type IORedis from 'ioredis'

/**
 * Live visitor counting for the dashboard's "Users in last 30 minutes" card.
 * One HyperLogLog per store per minute (PFADD by visitor id) so the count is
 * unique visitors, not page views; the 30-key PFCOUNT union gives the headline.
 * Keys expire after two hours; nothing is persisted.
 */
export const LIVE_MINUTES = 30
const KEY_TTL_SECONDS = 2 * 3600

export type LiveVisitors = {
  /** Unique visitors across the last 30 minutes. */
  last30: number
  /** Unique visitors per minute, oldest first, 30 entries. */
  perMinute: number[]
}

export const EMPTY_LIVE_VISITORS: LiveVisitors = {
  last30: 0,
  perMinute: Array.from({ length: LIVE_MINUTES }, () => 0),
}

const minuteOf = (now: Date) => Math.floor(now.getTime() / 60_000)

export const visitorsKey = (storeId: string, minute: number) => `{visitors}:${storeId}:${minute}`

/** Marks `visitorId` as seen in the current minute. Never throws: a lost beacon is fine. */
export async function recordVisit(
  redis: IORedis,
  storeId: string,
  visitorId: string,
  now = new Date(),
): Promise<void> {
  try {
    const key = visitorsKey(storeId, minuteOf(now))
    await redis.multi().pfadd(key, visitorId).expire(key, KEY_TTL_SECONDS).exec()
  } catch {
    // Dragonfly unavailable: the dashboard shows zeros until it is back.
  }
}

/** Per-minute uniques for the trailing window plus the union across it. */
export async function liveVisitors(
  redis: IORedis,
  storeId: string,
  now = new Date(),
): Promise<LiveVisitors> {
  try {
    const current = minuteOf(now)
    const keys = Array.from({ length: LIVE_MINUTES }, (_, i) =>
      visitorsKey(storeId, current - (LIVE_MINUTES - 1) + i),
    )
    const pipeline = redis.multi()
    for (const k of keys) pipeline.pfcount(k)
    pipeline.pfcount(...keys)
    const results = (await pipeline.exec()) ?? []
    const numbers = results.map(([, v]) => (typeof v === 'number' ? v : Number(v) || 0))
    const perMinute = numbers.slice(0, LIVE_MINUTES)
    const last30 = numbers[LIVE_MINUTES] ?? 0
    return { last30, perMinute }
  } catch {
    return EMPTY_LIVE_VISITORS
  }
}
