import type { RateLimitHit, RateLimitStore } from './limiter'

/**
 * In-process sliding-window store: a fake for tests, and a same-process
 * fallback for local dev without Dragonfly running. Never share one instance
 * across processes; it has no cross-process durability by design.
 */
export function createMemoryRateLimitStore(): RateLimitStore {
  const hits = new Map<string, number[]>()
  return {
    async hit(key, windowMs, now): Promise<RateLimitHit> {
      const cutoff = now - windowMs
      const kept = (hits.get(key) ?? []).filter((t) => t > cutoff)
      kept.push(now)
      hits.set(key, kept)
      return { count: kept.length, oldestMs: kept[0] ?? now }
    },
  }
}
