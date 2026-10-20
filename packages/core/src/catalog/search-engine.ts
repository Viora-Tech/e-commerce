/** SOURCE OF TRUTH: the product search engine hook — WHAT: one optional outside engine (the Meilisearch app) that turns a shopper's search words into product ids, best first; `browseProducts` and `suggestProducts` then load, filter, count and price those products in Postgres / WHY: typo-tolerant search plugs in without core importing the app, and RLS, prices and stock always come from our own rows. No engine registered, the store not using one, an error or a slow answer (over `ENGINE_BUDGET_MS`) all mean the built-in SQL search runs instead */
import type { StoreTx } from '@commerce/db'

/**
 * Product ids matching `query`, best first, at most `limit`; or null when this store has no
 * engine ready (app not installed, not connected, never indexed). Runs inside the caller's store
 * transaction so it can read the store's settings; it must give up when `signal` aborts.
 */
export type ProductSearchEngine = (input: {
  tx: StoreTx
  storeId: string
  query: string
  limit: number
  signal: AbortSignal
}) => Promise<string[] | null>

/** How long a search waits for the engine before falling back to SQL. */
const ENGINE_BUDGET_MS = 300

/** The most ids an engine hands over; Meilisearch's own default ceiling (`maxTotalHits`). */
const ENGINE_MAX_HITS = 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let engine: ProductSearchEngine | null = null

/** Registers (or with null, removes) the product search engine. The last one wins. */
export function setProductSearchEngine(next: ProductSearchEngine | null): void {
  engine = next
}

/**
 * Ids from the engine (uuids only, no repeats), or null when the SQL search should run: no
 * engine, the store not using one, no match, a failure, or no answer within `budgetMs`.
 */
export async function engineProductIds(
  tx: StoreTx,
  storeId: string,
  query: string,
  limit = ENGINE_MAX_HITS,
  budgetMs = ENGINE_BUDGET_MS,
): Promise<string[] | null> {
  const run = engine
  const q = query.trim()
  if (!run || !q) return null
  // The engine must honour the signal, so a slow answer ends here rather than holding up the page.
  const signal = AbortSignal.timeout(budgetMs)
  try {
    // A savepoint, so an engine that fails mid-query leaves the caller's transaction usable.
    const ids = await tx.transaction((sp) =>
      run({ tx: sp, storeId, query: q, limit: Math.min(limit, ENGINE_MAX_HITS), signal }),
    )
    if (!ids || signal.aborted) return null
    const clean = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, limit)
    // Nothing found: SQL still gets a go, since it matches inside words (part of a SKU) too.
    return clean.length ? clean : null
  } catch {
    return null
  }
}
