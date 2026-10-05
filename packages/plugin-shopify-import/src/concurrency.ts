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
 * A shared cap on bytes held at once (the importer's whole-read copies): each
 * caller reserves what it will hold before it reads, so a few large files never
 * share memory with a dozen others. Not a count, so many small ones still run
 * side by side.
 */
export function createByteBudget(total: number) {
  let used = 0
  const waiting: { bytes: number; go: () => void }[] = []
  // First come, first served: a large copy at the head is not overtaken by small ones for ever.
  const pump = () => {
    for (let next = waiting[0]; next; next = waiting[0]) {
      // One copy larger than the whole budget still runs, alone.
      if (used > 0 && used + next.bytes > total) return
      waiting.shift()
      used += next.bytes
      next.go()
    }
  }
  return {
    /**
     * Run `fn` once `bytes` fit in the budget, and give them back when it settles.
     * `signal` aborting while it waits gives up the place in the queue.
     */
    async use<T>(bytes: number, fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      await new Promise<void>((resolve, reject) => {
        const entry = {
          bytes,
          go: () => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
          },
        }
        const reason = () =>
          signal?.reason instanceof Error ? signal.reason : new Error('the copy was stopped')
        const onAbort = () => {
          const at = waiting.indexOf(entry)
          if (at === -1) return
          waiting.splice(at, 1)
          reject(reason())
          pump()
        }
        if (signal?.aborted) return reject(reason())
        signal?.addEventListener('abort', onAbort, { once: true })
        waiting.push(entry)
        pump()
      })
      try {
        return await fn()
      } finally {
        used -= bytes
        pump()
      }
    },
    /** Bytes reserved right now (tests). */
    get used() {
      return used
    },
  }
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
