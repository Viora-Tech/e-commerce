import type { StoreTx } from '@commerce/db'
import { media, newId, productMedia, variant } from '@commerce/db'
import {
  isAllowedContentType,
  isImageContentType,
  maxUploadBytesFor,
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
  const limit = maxUploadBytesFor(input.contentType)
  if (input.size > limit) {
    throw new InvalidUpload(`files must be under ${Math.round(limit / 1024 / 1024)} MB`)
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

/**
 * The browser finished the PUT; the object is now readable at its key. A
 * `HEAD` against the provider gets the real size — a browser can lie about
 * `Content-Length` at presign time, and this is the one place that catches
 * it before the row is trusted anywhere else. Oversized objects are deleted
 * from storage immediately rather than left as a `failed` row a merchant
 * could still reference.
 *
 * Images are handed to the upload-time pipeline (see
 * `packages/core/src/media/pipeline.ts`, run in the worker): the row goes
 * `processing` and the caller (the API router) enqueues the job. Video and
 * any other confirmed type has no pipeline and goes straight to `ready`.
 */
export async function confirmUpload(
  tx: StoreTx,
  id: string,
  provider: StorageProvider,
  dims?: { width?: number | undefined; height?: number | undefined },
) {
  const [existing] = await tx.select().from(media).where(eq(media.id, id))
  if (!existing) throw new CommerceError('NOT_FOUND', `Media ${id} not found`)

  let realSize: number | undefined
  if (existing.key) {
    const head = await provider.head(existing.key)
    const contentType = existing.contentType ?? ''
    const limit = maxUploadBytesFor(contentType)
    if (!head) throw new InvalidUpload('upload did not complete: the object is missing')
    if (head.size > limit) {
      await provider.delete(existing.key)
      await tx.delete(media).where(eq(media.id, id))
      throw new InvalidUpload(`files must be under ${Math.round(limit / 1024 / 1024)} MB`)
    }
    realSize = head.size
  }

  const needsPipeline = isImageContentType(existing.contentType ?? '')
  const [row] = await tx
    .update(media)
    .set({
      status: needsPipeline ? 'processing' : 'ready',
      ...(realSize !== undefined ? { size: realSize } : {}),
      ...(dims?.width ? { width: dims.width } : {}),
      ...(dims?.height ? { height: dims.height } : {}),
    })
    .where(eq(media.id, id))
    .returning()
  if (!row) throw new CommerceError('NOT_FOUND', `Media ${id} not found`)
  return row
}

export type MediaSort = 'newest' | 'oldest' | 'name' | 'size'
export type MediaFileType = 'image' | 'video'
export type MediaSizeBucket = 'small' | 'medium' | 'large'
export type MediaUsedFilter = 'used' | 'unused'

export type MediaListInput = {
  page: number
  perPage: number
  search?: string | undefined
  sort?: MediaSort | undefined
  fileType?: MediaFileType | undefined
  size?: MediaSizeBucket | undefined
  used?: MediaUsedFilter | undefined
}

const SIZE_BUCKETS: Record<MediaSizeBucket, [number, number | null]> = {
  small: [0, 200_000],
  medium: [200_000, 2_000_000],
  large: [2_000_000, null],
}

const usedSubquery = sql`(select count(*)::int from product_media pm where pm.media_id = media.id)`

/** Library listing: ready items newest first, with how many products use each. */
export async function listMedia(tx: StoreTx, input: MediaListInput) {
  const [sizeMin, sizeMax] = input.size ? SIZE_BUCKETS[input.size] : [null, null]
  const where = and(
    eq(media.status, 'ready'),
    input.search
      ? or(ilike(media.alt, `%${input.search}%`), ilike(media.key, `%${input.search}%`))
      : undefined,
    input.fileType ? ilike(media.contentType, `${input.fileType}/%`) : undefined,
    sizeMin !== null ? sql`${media.size} >= ${sizeMin}` : undefined,
    sizeMax !== null ? sql`${media.size} < ${sizeMax}` : undefined,
    input.used === 'used' ? sql`${usedSubquery} > 0` : undefined,
    input.used === 'unused' ? sql`${usedSubquery} = 0` : undefined,
  )
  const orderBy =
    input.sort === 'oldest'
      ? [asc(media.createdAt), asc(media.id)]
      : input.sort === 'name'
        ? [asc(media.key), asc(media.id)]
        : input.sort === 'size'
          ? [desc(media.size), desc(media.id)]
          : [desc(media.createdAt), desc(media.id)]
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
      /* For the pickers' <Picture> previews: responsive variants and the ThumbHash blur-up. */
      variants: sql<Record<string, { avif: string; webp: string }> | null>`${media.variants}`,
      thumbhash: media.thumbhash,
      createdAt: media.createdAt,
      /* Drizzle renders correlated columns unqualified inside a single-table select, so spell the join out. */
      usedBy: sql<number>`(select count(*)::int from product_media pm where pm.media_id = media.id)`,
    })
    .from(media)
    .where(where)
    .orderBy(...orderBy)
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
 * Generous default so the quota hook below is inert out of the box; a store
 * can be given a tighter number once billing on storage exists. Kept as an
 * env var rather than a store-table column: "no big schema change", and a
 * per-store override can arrive later as one more jsonb key on a settings
 * column already on the row (e.g. `store.preferences`) without a migration.
 */
export const DEFAULT_STORAGE_QUOTA_BYTES = 20 * 1024 * 1024 * 1024 // 20 GB

/** Bytes this store's ready media currently occupies, summed straight from the row sizes. */
export async function storageUsageBytes(tx: StoreTx, storeId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${media.size}), 0)::bigint` })
    .from(media)
    .where(and(eq(media.storeId, storeId), eq(media.status, 'ready')))
  return Number(row?.total ?? 0)
}

export type StorageQuotaCheck = { usedBytes: number; quotaBytes: number; ok: boolean }

/**
 * Not enforced anywhere yet (no upload is ever rejected for being over
 * quota) — this is the hook a future "Settings > Files > usage" page or a
 * billing gate calls. `quotaBytes` defaults to the generous env/const
 * ceiling; pass a store-specific one once that exists.
 */
export async function checkStorageQuota(
  tx: StoreTx,
  storeId: string,
  quotaBytes: number = Number(process.env.STORAGE_QUOTA_BYTES_DEFAULT) ||
    DEFAULT_STORAGE_QUOTA_BYTES,
): Promise<StorageQuotaCheck> {
  const usedBytes = await storageUsageBytes(tx, storeId)
  return { usedBytes, quotaBytes, ok: usedBytes <= quotaBytes }
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
 * Called by the worker once the upload-time pipeline (see `./pipeline.ts`)
 * finishes for one media row: `url`/`key` now point at the cleaned master
 * (so nothing GPS-tagged stays publicly reachable at the old key), `variants`
 * holds every generated width's AVIF/WebP URL, and the real dimensions and
 * ThumbHash are recorded. Setting `status: 'ready'` here — not at confirm —
 * is what makes `listMedia` (which filters `status = 'ready'`) wait for
 * processing before a product can use the image.
 */
export async function markMediaProcessed(
  tx: StoreTx,
  id: string,
  result: {
    url: string
    key: string
    provider: string
    contentType: string
    size: number
    width: number
    height: number
    variants: unknown
    thumbhash: string
  },
) {
  const [row] = await tx
    .update(media)
    .set({
      status: 'ready',
      url: result.url,
      key: result.key,
      provider: result.provider,
      contentType: result.contentType,
      size: result.size,
      width: result.width,
      height: result.height,
      variants: result.variants,
      thumbhash: result.thumbhash,
      processedAt: new Date(),
      processError: null,
    })
    .where(eq(media.id, id))
    .returning()
  if (!row) throw new CommerceError('NOT_FOUND', `Media ${id} not found`)
  return row
}

/** Called by the worker when the pipeline throws after its retries are exhausted; the admin media UI can show and let the merchant delete a `failed` row. */
export async function markMediaFailed(tx: StoreTx, id: string, error: string) {
  await tx
    .update(media)
    .set({ status: 'failed', processError: error.slice(0, 2000), processedAt: new Date() })
    .where(eq(media.id, id))
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
    .select({
      id: media.id,
      url: media.url,
      alt: media.alt,
      contentType: media.contentType,
      variants: media.variants,
      thumbhash: media.thumbhash,
    })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(eq(productMedia.productId, productId))
    .orderBy(asc(productMedia.position))
}
