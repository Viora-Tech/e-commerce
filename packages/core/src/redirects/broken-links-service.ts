/**
 * SOURCE OF TRUTH KEYWORDS: broken links, 404 log
 * WHAT:  Store the storefront's 404 counts (batched upserts) and list them for the admin's
 *        Broken links tab with a suggested redirect target; dismiss one.
 * WHY:   Old Shopify links and typos that still get traffic should become redirects.
 * WHERE: Storefront `lib/broken-links.ts` (record), API `redirects.brokenLinks` (list, dismiss).
 */
import { brokenLink, collection, product, type StoreTx, urlRedirect } from '@commerce/db'
import { and, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { type HandleOption, type RedirectSuggestion, suggestRedirect } from './broken-links'

/** Rows one store keeps; past it only paths already logged are counted (bots scan endlessly). */
export const BROKEN_LINKS_PER_STORE = 5000

/** Handles compared for suggestions; a bigger catalogue is compared on its first ones. */
const SUGGESTION_HANDLES = 5000

export type BrokenLinkHit = { path: string; hits: number; referrer: string | null }

export type BrokenLinkItem = {
  id: string
  path: string
  hits: number
  lastSeen: Date
  referrer: string | null
  suggestion: RedirectSuggestion | null
}

/** Add one flush of 404 counts. Paths are already filtered and normalised (`brokenLinkPath`). */
export async function recordBrokenLinks(
  tx: StoreTx,
  storeId: string,
  hits: BrokenLinkHit[],
): Promise<void> {
  if (hits.length === 0) return
  let rows = hits
  const [total] = await tx.select({ n: count() }).from(brokenLink)
  if ((total?.n ?? 0) >= BROKEN_LINKS_PER_STORE) {
    const known = await tx
      .select({ path: brokenLink.path })
      .from(brokenLink)
      .where(
        inArray(
          brokenLink.path,
          hits.map((h) => h.path),
        ),
      )
    const keep = new Set(known.map((k) => k.path))
    rows = hits.filter((h) => keep.has(h.path))
    if (rows.length === 0) return
  }
  await tx
    .insert(brokenLink)
    .values(rows.map((h) => ({ storeId, path: h.path, hits: h.hits, referrer: h.referrer })))
    .onConflictDoUpdate({
      target: [brokenLink.storeId, brokenLink.path],
      set: {
        hits: sql`${brokenLink.hits} + excluded.hits`,
        lastSeen: sql`now()`,
        referrer: sql`coalesce(excluded.referrer, ${brokenLink.referrer})`,
      },
    })
}

/** Live product and collection handles to suggest from. */
async function handleOptions(tx: StoreTx): Promise<HandleOption[]> {
  const [products, collections] = await Promise.all([
    tx
      .select({ handle: product.handle })
      .from(product)
      .where(eq(product.status, 'active'))
      .limit(SUGGESTION_HANDLES),
    tx
      .select({ handle: collection.handle })
      .from(collection)
      .where(eq(collection.status, 'active'))
      .limit(SUGGESTION_HANDLES),
  ])
  return [
    ...products.map((p) => ({ kind: 'product' as const, handle: p.handle })),
    ...collections.map((c) => ({ kind: 'collection' as const, handle: c.handle })),
  ]
}

/**
 * The most-hit broken paths, skipping dismissed ones (until hit again after the dismissal) and
 * paths a redirect now covers.
 */
export async function listBrokenLinks(
  tx: StoreTx,
  input: { page: number; perPage: number; query?: string | undefined },
): Promise<{ items: BrokenLinkItem[]; total: number }> {
  const q = input.query?.trim()
  const where = and(
    q ? ilike(brokenLink.path, `%${q}%`) : undefined,
    or(isNull(brokenLink.dismissedAt), gt(brokenLink.lastSeen, brokenLink.dismissedAt)),
    sql`not exists (select 1 from ${urlRedirect} where ${urlRedirect.path} = ${brokenLink.path})`,
  )
  const [total] = await tx.select({ n: count() }).from(brokenLink).where(where)
  const rows = await tx
    .select({
      id: brokenLink.id,
      path: brokenLink.path,
      hits: brokenLink.hits,
      lastSeen: brokenLink.lastSeen,
      referrer: brokenLink.referrer,
    })
    .from(brokenLink)
    .where(where)
    .orderBy(desc(brokenLink.hits), desc(brokenLink.lastSeen))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const options = rows.length > 0 ? await handleOptions(tx) : []
  return {
    items: rows.map((r) => ({ ...r, suggestion: suggestRedirect(r.path, options) })),
    total: total?.n ?? 0,
  }
}

/** Hide broken paths from the list; one that is hit again later comes back. */
export async function dismissBrokenLinks(tx: StoreTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .update(brokenLink)
    .set({ dismissedAt: sql`now()` })
    .where(inArray(brokenLink.id, ids))
    .returning({ id: brokenLink.id })
  return rows.length
}
