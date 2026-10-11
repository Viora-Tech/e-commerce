/**
 * A least-recently-used cache with a size budget and per-entry expiry, for the storefront's
 * render caches (`store-cache.ts`, `liquid-cache.ts`). Pure: no I/O, the clock is injectable.
 * Sizes are what the caller says (`approxSize` for data, string length for HTML): a budget, not
 * an exact heap measurement.
 */

type Entry<V> = { value: V; size: number; expiresAt: number }

export type LruOptions = {
  /** Total size the cache may hold; the least recently used entries go first. 0 turns it off. */
  maxSize: number
  now?: () => number
}

export class LruCache<V> {
  readonly #entries = new Map<string, Entry<V>>()
  readonly #maxSize: number
  readonly #now: () => number
  #size = 0

  constructor(options: LruOptions) {
    this.#maxSize = options.maxSize
    this.#now = options.now ?? Date.now
  }

  get size(): number {
    return this.#size
  }

  get count(): number {
    return this.#entries.size
  }

  /** The live value, now the most recently used; undefined when missing or expired. */
  get(key: string): V | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    this.#entries.delete(key)
    if (entry.expiresAt <= this.#now()) {
      this.#size -= entry.size
      return undefined
    }
    this.#entries.set(key, entry)
    return entry.value
  }

  /** Stores a value for `ttlMs`. One bigger than a quarter of the budget is not kept. */
  set(key: string, value: V, size: number, ttlMs: number): void {
    this.delete(key)
    if (this.#maxSize <= 0 || size > this.#maxSize / 4 || ttlMs <= 0) return
    this.#entries.set(key, { value, size, expiresAt: this.#now() + ttlMs })
    this.#size += size
    for (const [oldest, entry] of this.#entries) {
      if (this.#size <= this.#maxSize) break
      this.#entries.delete(oldest)
      this.#size -= entry.size
    }
  }

  delete(key: string): void {
    const entry = this.#entries.get(key)
    if (!entry) return
    this.#entries.delete(key)
    this.#size -= entry.size
  }

  clear(): void {
    this.#entries.clear()
    this.#size = 0
  }
}

/** Rough in-memory size of plain data (strings, numbers, arrays, objects, maps, dates). */
export function approxSize(value: unknown): number {
  let total = 0
  const stack: unknown[] = [value]
  // Plain data only; a cycle or a huge graph stops counting rather than looping.
  let budget = 200_000
  while (stack.length > 0 && budget-- > 0) {
    const v = stack.pop()
    if (typeof v === 'string') total += v.length + 16
    else if (v === null || typeof v !== 'object') total += 16
    else if (v instanceof Date) total += 32
    else if (v instanceof Map) {
      total += 32
      for (const [k, item] of v) stack.push(k, item)
    } else if (Array.isArray(v)) {
      total += 16 + v.length * 8
      for (const item of v) stack.push(item)
    } else {
      total += 32
      for (const [k, item] of Object.entries(v)) {
        total += k.length + 8
        stack.push(item)
      }
    }
  }
  return total
}
