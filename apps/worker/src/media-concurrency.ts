/**
 * Shared by the `media:rehost` and `media:reprocess` scripts: `--concurrency <n>` and a small
 * pool to run rows side by side. `processImage` (sharp) is CPU-bound, so the useful number is
 * about the machine's cores; the cap keeps it under the DB pool (`createDb`'s `max: 10`), since
 * each row in flight holds its own `withStore` transaction while it works.
 */
export const DEFAULT_CONCURRENCY = 2
export const MAX_CONCURRENCY = 8

/** `--concurrency <n>` from argv: default 2, clamped to 1..8; anything not a number is an error. */
export function parseConcurrency(argv: string[]): number {
  const idx = argv.indexOf('--concurrency')
  if (idx === -1) return DEFAULT_CONCURRENCY
  const n = Number(argv[idx + 1])
  if (!Number.isInteger(n)) throw new Error('--concurrency takes a whole number (1-8)')
  return Math.max(1, Math.min(MAX_CONCURRENCY, n))
}

/**
 * Run `fn` over `items` with at most `limit` in flight. `fn` handles its own errors (each row
 * logs and counts its failure); a throw here would stop the other workers' remaining rows.
 */
export async function forEachLimit<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  async function worker() {
    while (next < items.length) await fn(items[next++] as T)
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
}
