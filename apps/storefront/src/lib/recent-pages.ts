/**
 * The pages each store's shoppers viewed lately, for the cache warmer (`cache-warm.ts`):
 * `proxy.ts` notes every page view here. Kept on `globalThis`, because the proxy and the pages
 * are separate bundles in one process.
 */

/** Pages kept per store, most recent first. */
const MAX_PAGES = 8
/** A page not viewed for this long is not warmed. */
const STALE_MS = 24 * 60 * 60_000

/** Marks the warmer's own requests, so they are not noted as views. */
export const WARM_USER_AGENT = 'storefront-cache-warm'

export type PageVisit = { host: string; proto: string | null; path: string; at: number }

const g = globalThis as unknown as { __storefrontVisits?: Map<string, Map<string, PageVisit>> }

function visits(): Map<string, Map<string, PageVisit>> {
  g.__storefrontVisits ??= new Map()
  return g.__storefrontVisits
}

/** Remembers a page view (path only; the query string is the shopper's). */
export function noteVisit(storeId: string, visit: Omit<PageVisit, 'at'>, now = Date.now()): void {
  const all = visits()
  let pages = all.get(storeId)
  if (!pages) {
    pages = new Map()
    all.set(storeId, pages)
  }
  const key = `${visit.host}${visit.path}`
  pages.delete(key)
  pages.set(key, { ...visit, at: now })
  while (pages.size > MAX_PAGES) {
    const oldest = pages.keys().next().value
    if (oldest === undefined) break
    pages.delete(oldest)
  }
}

/** The pages worth warming for a store, most recent first. */
export function pagesToWarm(storeId: string, now = Date.now()): PageVisit[] {
  const pages = [...(visits().get(storeId)?.values() ?? [])]
  return pages.filter((v) => now - v.at < STALE_MS).reverse()
}
