import type { StoreTx } from '@commerce/db'
import { media, newId, productMedia, variant } from '@commerce/db'
import {
  isAllowedContentType,
  MAX_UPLOAD_BYTES,
  mediaKey,
  type PresignedUpload,
  type StorageProvider,
} from '@commerce/storage'
import { and, asc, desc, eq, ilike, inArray, isNotNull, notInArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { CommerceError } from '../errors'

export const UploadIntentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(100),
  size: z.number().int().min(1),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
})
export type UploadIntent = z.infer<typeof UploadIntentSchema>

export class InvalidUpload extends CommerceError {
  constructor(message: string) {
    super('VALIDATION', message)
  }
}

export type UploadTicket = {
  mediaId: string
  url: string
  upload: PresignedUpload
}

/**
 * Reserve a media row and sign the upload. The row is `pending` until the
 * browser confirms; a failed or abandoned upload leaves a pending row that
 * never shows anywhere and can be swept.
 */
export async function createUploadIntent(
  tx: StoreTx,
  storeId: string,
  provider: StorageProvider,
  input: UploadIntent,
): Promise<UploadTicket> {
  if (!isAllowedContentType(input.contentType)) {
    throw new InvalidUpload(`${input.contentType} is not an image or mp4 video`)
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    throw new InvalidUpload(`files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`)
  }
  const id = newId()
  const key = mediaKey({ storeId, filename: input.filename, contentType: input.contentType, id })
  const upload = await provider.presignUpload({
    key,
    contentType: input.contentType,
    size: input.size,
  })
  const url = provider.publicUrl(key)
  await tx.insert(media).values({
    id,
    storeId,
    url,
    key,
    provider: provider.id,
    contentType: input.contentType,
    size: input.size,
    width: input.width ?? null,
    height: input.height ?? null,
    status: 'pending',
  })
  return { mediaId: id, url, upload }
}

/** The browser finished the PUT; the object is now readable at `url`. */
export async function confirmUpload(
  tx: StoreTx,
  id: string,
  dims?: { width?: number | undefined; height?: number | undefined },
) {
  const [row] = await tx
    .update(media)
    .set({
      status: 'ready',
      ...(dims?.width ? { width: dims.width } : {}),
      ...(dims?.height ? { height: dims.height } : {}),
    })
    .where(eq(media.id, id))
    .returning()
  if (!row) throw new CommerceError('NOT_FOUND', `Media ${id} not found`)
  return row
}

export type MediaListInput = {
  page: number
  perPage: number
  search?: string | undefined
}

/** Library listing: ready items newest first, with how many products use each. */
export async function listMedia(tx: StoreTx, input: MediaListInput) {
  const where = and(
    eq(media.status, 'ready'),
    input.search
      ? or(ilike(media.alt, `%${input.search}%`), ilike(media.key, `%${input.search}%`))
      : undefined,
  )
  const [countRow] = await tx.select({ n: sql<number>`count(*)::int` }).from(media).where(where)
  const rows = await tx
    .select({
      id: media.id,
      url: media.url,
      key: media.key,
      alt: media.alt,
      contentType: media.contentType,
      size: media.size,
      width: media.width,
      height: media.height,
      createdAt: media.createdAt,
      /* Drizzle renders correlated columns unqualified inside a single-table select, so spell the join out. */
      usedBy: sql<number>`(select count(*)::int from product_media pm where pm.media_id = media.id)`,
    })
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items: rows, total: countRow?.n ?? 0 }
}

export async function updateMedia(tx: StoreTx, id: string, patch: { alt?: string | null }) {
  const [row] = await tx.update(media).set(patch).where(eq(media.id, id)).returning()
  if (!row) throw new CommerceError('NOT_FOUND', `Media ${id} not found`)
  return row
}

/**
 * Remove a file everywhere: product galleries, variant thumbnails, the row,
 * then the object. Storage last, so a failed delete leaves nothing dangling.
 */
export async function deleteMedia(tx: StoreTx, id: string, provider: StorageProvider) {
  const [row] = await tx.select().from(media).where(eq(media.id, id))
  if (!row) throw new CommerceError('NOT_FOUND', `Media ${id} not found`)
  await tx.delete(productMedia).where(eq(productMedia.mediaId, id))
  await tx.update(variant).set({ mediaId: null }).where(eq(variant.mediaId, id))
  await tx.delete(media).where(eq(media.id, id))
  if (row.key && row.provider === provider.id) await provider.delete(row.key)
  return row
}

/**
 * Replace a product's gallery with these media ids in this order. Position 0
 * is the cover. Ids that are not ready media of this store are ignored rather
 * than rejected, so a stale form cannot block a save.
 */
export async function setProductMedia(
  tx: StoreTx,
  storeId: string,
  productId: string,
  mediaIds: string[],
) {
  const unique = [...new Set(mediaIds)]
  const valid = unique.length
    ? await tx
        .select({ id: media.id })
        .from(media)
        .where(and(inArray(media.id, unique), eq(media.status, 'ready')))
    : []
  const keep = new Set(valid.map((v) => v.id))
  const ordered = unique.filter((id) => keep.has(id))
  await tx.delete(productMedia).where(eq(productMedia.productId, productId))
  if (ordered.length) {
    await tx
      .insert(productMedia)
      .values(ordered.map((mediaId, position) => ({ storeId, productId, mediaId, position })))
  }
  // A variant thumbnail must still be in the gallery.
  await tx
    .update(variant)
    .set({ mediaId: null })
    .where(
      and(
        eq(variant.productId, productId),
        isNotNull(variant.mediaId),
        ordered.length ? notInArray(variant.mediaId, ordered) : undefined,
      ),
    )
  return ordered
}

/** Gallery for one product, cover first. */
export async function productGallery(tx: StoreTx, productId: string) {
  return tx
    .select({ id: media.id, url: media.url, alt: media.alt, contentType: media.contentType })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, productId))
    .orderBy(asc(productMedia.position))
}
