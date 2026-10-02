/** SOURCE OF TRUTH: AI product field changes and their undo — WHAT reads, patches and restores the product fields AI may change (title, description, search text, tags, photo alt text) / WHY the assistant, the bulk writer and Undo touch them one way, inside RLS */
import { media, product, productMedia, type StoreTx } from '@commerce/db'
import { asc, eq, inArray } from 'drizzle-orm'
import { syncAutomaticCollections } from '../collections/service'

/** What AI may change on a product. `description` is Lexical JSON (see @commerce/richtext). */
export type ProductFieldsPatch = {
  title?: string | undefined
  description?: unknown
  seoTitle?: string | null | undefined
  seoDescription?: string | null | undefined
  tags?: string[] | undefined
  /** Alt text per photo id; only the product's own photos are changed. */
  mediaAlt?: { mediaId: string; alt: string | null }[] | undefined
}

/** The product's fields as they were, so an AI change can be undone. */
export type ProductFieldsSnapshot = {
  productId: string
  title: string
  description: unknown
  seoTitle: string | null
  seoDescription: string | null
  tags: string[]
  mediaAlt: { mediaId: string; alt: string | null }[]
}

/** The product's photo ids in gallery order, per product (RLS: the store's own only). */
export async function productPhotoIds(
  tx: StoreTx,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!productIds.length) return out
  const rows = await tx
    .select({ productId: productMedia.productId, mediaId: productMedia.mediaId })
    .from(productMedia)
    .where(inArray(productMedia.productId, productIds))
    .orderBy(asc(productMedia.position))
  for (const row of rows) out.set(row.productId, [...(out.get(row.productId) ?? []), row.mediaId])
  return out
}

/** Current fields of `productIds` (another store's ids find nothing under RLS). */
export async function productFieldsSnapshot(
  tx: StoreTx,
  productIds: string[],
): Promise<ProductFieldsSnapshot[]> {
  if (!productIds.length) return []
  const rows = await tx
    .select({
      productId: product.id,
      title: product.title,
      description: product.description,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      tags: product.tags,
    })
    .from(product)
    .where(inArray(product.id, productIds))
  const photos = await productPhotoIds(tx, productIds)
  const mediaIds = [...photos.values()].flat()
  const alts = mediaIds.length
    ? await tx
        .select({ id: media.id, alt: media.alt })
        .from(media)
        .where(inArray(media.id, mediaIds))
    : []
  return rows.map((row) => ({
    ...row,
    mediaAlt: (photos.get(row.productId) ?? []).map((mediaId) => ({
      mediaId,
      alt: alts.find((a) => a.id === mediaId)?.alt ?? null,
    })),
  }))
}

async function writeFields(
  tx: StoreTx,
  productId: string,
  patch: ProductFieldsPatch,
): Promise<boolean> {
  const set = Object.fromEntries(
    Object.entries({
      title: patch.title,
      description: patch.description,
      seoTitle: patch.seoTitle,
      seoDescription: patch.seoDescription,
      tags: patch.tags,
    }).filter(([, v]) => v !== undefined),
  )
  const [row] = Object.keys(set).length
    ? await tx
        .update(product)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(product.id, productId))
        .returning({ id: product.id })
    : await tx.select({ id: product.id }).from(product).where(eq(product.id, productId))
  if (!row) return false
  if (patch.mediaAlt?.length) {
    const own = new Set((await productPhotoIds(tx, [productId])).get(productId) ?? [])
    for (const { mediaId, alt } of patch.mediaAlt) {
      if (!own.has(mediaId)) continue
      await tx.update(media).set({ alt }).where(eq(media.id, mediaId))
    }
  }
  return true
}

/**
 * Writes AI changes to products, then refreshes automatic collections when tags changed
 * (a tag rule may now match). Returns how many products were found and changed.
 */
export async function patchProductFields(
  tx: StoreTx,
  storeId: string,
  patches: { productId: string; patch: ProductFieldsPatch }[],
): Promise<number> {
  let changed = 0
  for (const { productId, patch } of patches) {
    if (await writeFields(tx, productId, patch)) changed++
  }
  if (patches.some((p) => p.patch.tags !== undefined)) await syncAutomaticCollections(tx, storeId)
  return changed
}

/** Puts products back the way a snapshot saw them (Undo). */
export async function restoreProductFields(
  tx: StoreTx,
  storeId: string,
  snapshots: ProductFieldsSnapshot[],
): Promise<number> {
  return patchProductFields(
    tx,
    storeId,
    snapshots.map(({ productId, ...before }) => ({ productId, patch: before })),
  )
}
