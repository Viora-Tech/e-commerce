/** SOURCE OF TRUTH: a variant's images — WHAT: the ordered `variant_media` list per variant, kept in step with `variant.media_id` (always its first image, null with none), read and written here only / WHY: carts, orders, feeds, catalogue sync and Liquid `variant.image` read the single column; the product page and themes read the list, so both must agree after every write path (product save, imports, media deletes, gallery edits) */
import type { StoreTx } from '@commerce/db'
import { media, newId, product, productMedia, variant, variantMedia } from '@commerce/db'
import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { noteProductsChanged } from './changes'

/** Most images one variant can hold, the same cap the product gallery has in practice. */
export const VARIANT_MEDIA_MAX = 50

/** Statuses a product may show: confirmed files, optimised or still being optimised. */
const USABLE: ('processing' | 'ready')[] = ['processing', 'ready']

/** Each variant's image ids in order. A variant with no list rows but a `media_id` reads as that one image. */
export async function loadVariantMedia(
  tx: StoreTx,
  variantIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (variantIds.length === 0) return out
  const ids = [...new Set(variantIds)]
  const [rows, singles] = await Promise.all([
    tx
      .select({ variantId: variantMedia.variantId, mediaId: variantMedia.mediaId })
      .from(variantMedia)
      .where(inArray(variantMedia.variantId, ids))
      .orderBy(asc(variantMedia.variantId), asc(variantMedia.position)),
    tx
      .select({ id: variant.id, mediaId: variant.mediaId })
      .from(variant)
      .where(inArray(variant.id, ids)),
  ])
  for (const r of rows) out.set(r.variantId, [...(out.get(r.variantId) ?? []), r.mediaId])
  for (const v of singles) {
    if (!out.has(v.id)) out.set(v.id, v.mediaId ? [v.mediaId] : [])
  }
  return out
}

/** Ids without repeats, first occurrence wins. */
function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

/**
 * The list a product-form write leaves on a variant. `mediaIds` (the form's ordered list) wins;
 * a writer that only knows the single image (imports, bulk tools) puts it first and keeps the
 * rest of what the variant already had, or clears the list when it sends no image.
 */
export function nextVariantMedia(
  input: { mediaId?: string | null | undefined; mediaIds?: string[] | undefined },
  current: readonly string[],
): string[] {
  if (input.mediaIds !== undefined) return uniqueIds(input.mediaIds)
  if (!input.mediaId) return []
  return uniqueIds([input.mediaId, ...current])
}

/**
 * Replace one variant's list with `mediaIds` (already checked as this store's) and point
 * `variant.media_id` at the first. Skips the write when nothing changed. Pass `current` (the
 * list before) only when the caller has already written `variant.media_id` to match.
 */
export async function writeVariantMedia(
  tx: StoreTx,
  storeId: string,
  variantId: string,
  mediaIds: readonly string[],
  current?: readonly string[],
): Promise<void> {
  const list = uniqueIds(mediaIds)
  const before = current ?? (await loadVariantMedia(tx, [variantId])).get(variantId) ?? []
  const same = before.length === list.length && before.every((id, i) => id === list[i])
  if (!same) {
    await tx.delete(variantMedia).where(eq(variantMedia.variantId, variantId))
    if (list.length) {
      await tx
        .insert(variantMedia)
        .values(
          list.map((mediaId, position) => ({ id: newId(), storeId, variantId, mediaId, position })),
        )
    }
  }
  // A product save already wrote the column from the same list (`variantRow`); others need it.
  if (!same || current === undefined) {
    await tx
      .update(variant)
      .set({ mediaId: list[0] ?? null })
      .where(eq(variant.id, variantId))
  }
}

/** Re-point `variant.media_id` at each variant's first remaining image (after rows were removed). */
export async function syncFeaturedMedia(tx: StoreTx, variantIds: readonly string[]): Promise<void> {
  if (variantIds.length === 0) return
  await tx
    .update(variant)
    .set({
      mediaId: sql`(select ${variantMedia.mediaId} from ${variantMedia}
        where ${variantMedia.variantId} = ${variant.id}
        order by ${variantMedia.position} limit 1)`,
    })
    .where(inArray(variant.id, [...new Set(variantIds)]))
}

/**
 * Drop variant images that are no longer in the product's gallery (`gallery`, in order), then
 * renumber and re-point each variant's main image. Called whenever the gallery is replaced.
 */
export async function pruneVariantMedia(
  tx: StoreTx,
  productId: string,
  gallery: readonly string[],
): Promise<void> {
  const variants = await tx
    .select({ id: variant.id })
    .from(variant)
    .where(eq(variant.productId, productId))
  const ids = variants.map((v) => v.id)
  if (ids.length === 0) return
  await tx
    .delete(variantMedia)
    .where(
      and(
        inArray(variantMedia.variantId, ids),
        gallery.length ? notInArray(variantMedia.mediaId, [...gallery]) : undefined,
      ),
    )
  await syncFeaturedMedia(tx, ids)
}

/** Variants that list this file, so a delete can re-point their main image. */
export async function variantsUsingMedia(tx: StoreTx, mediaId: string): Promise<string[]> {
  const [listed, single] = await Promise.all([
    tx
      .select({ id: variantMedia.variantId })
      .from(variantMedia)
      .where(eq(variantMedia.mediaId, mediaId)),
    tx.select({ id: variant.id }).from(variant).where(eq(variant.mediaId, mediaId)),
  ])
  return uniqueIds([...listed, ...single].map((r) => r.id))
}

/**
 * Set one variant's images, in order (first = the variant's main image). Each id must be a
 * usable file of this store; one not yet in the product's gallery is added to its end, so an
 * image uploaded for a variant also shows on the product. An empty list clears the images.
 */
export async function setVariantMedia(
  tx: StoreTx,
  storeId: string,
  variantId: string,
  mediaIds: string[],
): Promise<{ variantId: string; productId: string; mediaIds: string[] }> {
  const list = uniqueIds(mediaIds)
  if (list.length > VARIANT_MEDIA_MAX) {
    throw new CommerceError('BAD_REQUEST', `A variant holds at most ${VARIANT_MEDIA_MAX} images`)
  }
  const [row] = await tx
    .select({ id: variant.id, productId: variant.productId })
    .from(variant)
    .where(eq(variant.id, variantId))
  if (!row) throw new CommerceError('NOT_FOUND', `Variant ${variantId} not found`, { storeId })
  const usable = list.length
    ? await tx
        .select({ id: media.id })
        .from(media)
        .where(and(inArray(media.id, list), inArray(media.status, USABLE)))
    : []
  const known = new Set(usable.map((m) => m.id))
  const missing = list.filter((id) => !known.has(id))
  if (missing.length) {
    throw new CommerceError('NOT_FOUND', `Media ${missing.join(', ')} not found`, { storeId })
  }
  const gallery = await tx
    .select({ mediaId: productMedia.mediaId, position: productMedia.position })
    .from(productMedia)
    .where(eq(productMedia.productId, row.productId))
  const inGallery = new Set(gallery.map((g) => g.mediaId))
  const added = list.filter((id) => !inGallery.has(id))
  if (added.length) {
    const next = gallery.reduce((max, g) => Math.max(max, g.position + 1), 0)
    await tx.insert(productMedia).values(
      added.map((mediaId, i) => ({
        id: newId(),
        storeId,
        productId: row.productId,
        mediaId,
        position: next + i,
      })),
    )
  }
  await writeVariantMedia(tx, storeId, variantId, list)
  await tx.update(product).set({ updatedAt: new Date() }).where(eq(product.id, row.productId))
  await noteProductsChanged(tx, [row.productId], storeId)
  return { variantId, productId: row.productId, mediaIds: list }
}
