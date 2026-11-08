/** SOURCE OF TRUTH: product photos in order emails — WHAT: each product's cover image (lowest gallery position that is a picture) / WHY: the old lookup asked for position 0 exactly and took videos too, so a gallery whose first slot was a video, or that did not start at 0, sent a blank box beside the line */
import { media, productMedia, type StoreTx } from '@commerce/db'
import { and, asc, eq, inArray, isNull, like, or } from 'drizzle-orm'

/** A media row a mail client can show as a picture (no videos, no 3D models). */
export const emailPicture = or(isNull(media.contentType), like(media.contentType, 'image/%'))

/** Each product's cover photo URL, by product id; products with no picture are left out. */
export async function productCoverImages(
  tx: StoreTx,
  productIds: readonly string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map()
  const rows = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(and(inArray(productMedia.productId, [...productIds]), emailPicture))
    .orderBy(asc(productMedia.position))
  const out = new Map<string, string>()
  for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, r.url)
  return out
}
