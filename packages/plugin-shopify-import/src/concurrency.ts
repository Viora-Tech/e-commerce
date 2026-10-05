/**
 * A minimal `mapLimit`: run `fn` over `items` with at most `limit` in flight at
 * once, preserving `items`' order in the result. No dependency pulled in for
 * this — just enough to bound concurrency for image downloads and per-record
 * writes that don't need to run strictly one at a time.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  if (items.length === 0) return results
  const size = Math.max(1, Math.min(limit, items.length))
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i] as T, i)
    }
  }
  await Promise.all(Array.from({ length: size }, worker))
  return results
}

/**
 * A shared cap on how many of something run at once, across every caller
 * (each product's images and the Files step all go through one limiter, so
 * however the callers fan out, at most `max` downloads hold memory at a time).
 */
export function createLimiter(max: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    while (active >= max) await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
      return await fn()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}
