/** SOURCE OF TRUTH: collections in a predictive search — WHAT: the active collections whose title holds every word a shopper typed / WHY: Shopify's predictive search lists matching collections beside products, and imported themes draw that column */
import { collection, media, type StoreTx } from '@commerce/db'
import { and, asc, eq, ilike, sql } from 'drizzle-orm'
import { searchTerms } from './search-text'

export type CollectionSearchHit = {
  id: string
  handle: string
  title: string
  imageUrl: string | null
}

const escapeLike = (w: string) => w.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Active collections whose title holds every word of `query`, shortest (closest) title first. */
export async function searchCollections(
  tx: StoreTx,
  query: string,
  limit: number,
): Promise<CollectionSearchHit[]> {
  const words = searchTerms(query)
  if (!words.length) return []
  return tx
    .select({
      id: collection.id,
      handle: collection.handle,
      title: collection.title,
      imageUrl: media.url,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .where(
      and(
        eq(collection.status, 'active'),
        ...words.map((w) => ilike(collection.title, `%${escapeLike(w)}%`)),
      ),
    )
    .orderBy(asc(sql`length(${collection.title})`), asc(collection.title))
    .limit(limit)
}
