/** SOURCE OF TRUTH: the search queries hook — WHAT: one optional source of the real Google searches that brought visitors to a storefront page (Google Search Console), which "Suggest keywords" grounds its suggestions in / WHY: keywords work with or without a Search Console connection, so the connection plugs in here instead of the keyword code depending on it. No source registered (or one that fails) means no queries, never an error */
import type { StoreTx } from '@commerce/db'

/** One search query and how it did for a page. */
export type PageSearchQuery = { query: string; clicks: number; impressions: number }

/**
 * Reads stored queries for one storefront path (`/products/<handle>`), best first. Runs inside
 * the caller's store transaction, so it reads what was synced earlier and never calls Google.
 */
export type SearchQueriesSource = (input: {
  tx: StoreTx
  storeId: string
  path: string
}) => Promise<PageSearchQuery[]>

/** Most queries handed to the keyword writer. */
const QUERIES_MAX = 20

let source: SearchQueriesSource | null = null

/** Registers (or with null, removes) the store-wide queries source. The last one wins. */
export function setSearchQueriesSource(next: SearchQueriesSource | null): void {
  source = next
}

/** The queries that brought visitors to `path`, or none when no source is set or it fails. */
export async function searchQueriesForPath(
  tx: StoreTx,
  storeId: string,
  path: string,
): Promise<PageSearchQuery[]> {
  const read = source
  if (!read) return []
  try {
    // A savepoint, so a failing source leaves the caller's transaction usable.
    const rows = await tx.transaction((sp) => read({ tx: sp, storeId, path }))
    return rows.filter((r) => r.query.trim()).slice(0, QUERIES_MAX)
  } catch {
    return []
  }
}
