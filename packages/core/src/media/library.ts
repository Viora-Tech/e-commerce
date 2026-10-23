/** SOURCE OF TRUTH: Files library file page — WHAT one file with its status, its previous / next in the library order, and the products using it / WHY the admin's /content/files/[id] page reads these three */
import type { StoreTx } from '@commerce/db'
import { media, product, productMedia } from '@commerce/db'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { libraryColumns, libraryWhere, type MediaListInput } from './service'

/** One file for its page in the library: the list item's columns plus its status; null when missing. */
export async function getMedia(tx: StoreTx, id: string) {
  const [row] = await tx
    .select({ ...libraryColumns, status: media.status })
    .from(media)
    .where(eq(media.id, id))
  return row ?? null
}

/**
 * The files either side of this one in the library's default order (newest first) under the
 * same search and type filter: `previous` is newer, `next` older. Null at either end.
 */
export async function mediaNeighbours(
  tx: StoreTx,
  id: string,
  filters: Pick<MediaListInput, 'search' | 'fileType'>,
) {
  const where = libraryWhere(filters)
  /* Compared in SQL: created_at keeps microseconds a JS Date would round away. */
  const self = sql`(select m.created_at, m.id from media m where m.id = ${id}::uuid)`
  const [previous] = await tx
    .select({ id: media.id })
    .from(media)
    .where(and(where, sql`(media.created_at, media.id) > ${self}`))
    .orderBy(asc(media.createdAt), asc(media.id))
    .limit(1)
  const [next] = await tx
    .select({ id: media.id })
    .from(media)
    .where(and(where, sql`(media.created_at, media.id) < ${self}`))
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(1)
  return { previous: previous?.id ?? null, next: next?.id ?? null }
}

/** The products whose gallery holds this file, by title: the file page's "Used in". */
export async function mediaUsedIn(tx: StoreTx, id: string) {
  return tx
    .select({ productId: product.id, title: product.title })
    .from(productMedia)
    .innerJoin(product, eq(product.id, productMedia.productId))
    .where(eq(productMedia.mediaId, id))
    .orderBy(asc(product.title), asc(product.id))
}
