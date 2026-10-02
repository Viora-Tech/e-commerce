/** SOURCE OF TRUTH: product photos sent to an AI writer — WHAT reads up to three of the store's own photos (the 640px WebP variant when there is one) for a model / WHY "Write with AI" and bulk AI runs send the same, small, store-scoped images */
import { WRITER_MAX_PHOTOS } from '@commerce/ai/client'
import { settingsSecret } from '@commerce/config'
import { media, type StoreTx } from '@commerce/db'
import { inArray } from 'drizzle-orm'
import { variantKey } from '../media/constants'
import { storageForStore } from '../media/settings'
import { registriesForStore } from '../plugins/registries'

/** Model-friendly photo formats; anything else (video, SVG, GIF) is skipped. */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
/** A photo bigger than this is skipped rather than sent (the 640px variant is ~50 KB). */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const VISION_WIDTH = 640

export type WriterPhoto = { mediaId: string; data: Uint8Array; mediaType: string }

/**
 * The first few of `ids` that are this store's images, read from its own storage. RLS: another
 * store's media id simply finds no row. A photo the storage cannot return is skipped.
 */
export async function writerPhotos(
  tx: StoreTx,
  storeId: string,
  ids: string[],
  secret?: string,
): Promise<WriterPhoto[]> {
  if (!ids.length) return []
  const rows = await tx
    .select({
      id: media.id,
      key: media.key,
      contentType: media.contentType,
      variants: media.variants,
    })
    .from(media)
    .where(inArray(media.id, ids))
  const ordered = ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is (typeof rows)[number] =>
      Boolean(r?.key && IMAGE_TYPES.has(r.contentType ?? '')),
    )
    .slice(0, WRITER_MAX_PHOTOS)
  if (!ordered.length) return []
  const registries = await registriesForStore(tx, storeId)
  const storage = await storageForStore(tx, storeId, registries.storage, secret ?? settingsSecret())
  const photos: WriterPhoto[] = []
  for (const row of ordered) {
    const key = row.key as string
    const hasVariant = Boolean(
      (row.variants as Record<string, unknown> | null)?.[String(VISION_WIDTH)],
    )
    const bytes = await storage
      .get(hasVariant ? variantKey(key, VISION_WIDTH, 'webp') : key)
      .catch(() => null)
    if (!bytes || bytes.byteLength > MAX_PHOTO_BYTES) continue
    photos.push({
      mediaId: row.id,
      data: bytes,
      mediaType: hasVariant ? 'image/webp' : (row.contentType as string),
    })
  }
  return photos
}
