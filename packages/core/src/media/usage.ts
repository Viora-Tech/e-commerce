/** SOURCE OF TRUTH: media file types (image, video, document), the library's type filter and the storage usage breakdown */
import type { StoreTx } from '@commerce/db'
import { media } from '@commerce/db'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { CONTENT_TYPE_BY_EXTENSION } from './content-type'

export type MediaFileType = 'image' | 'video' | 'document'

/**
 * The row's type, else the one the extension of its key (or URL, without `?query`) implies,
 * as `contentTypeFromName` does: a row stored without a type still sorts as an image or video.
 * Literals only (no bind parameters), so the expression can sit in a GROUP BY.
 */
const typeOf = sql`coalesce(${media.contentType}, case lower(substring(split_part(coalesce(${media.key}, ${media.url}), '?', 1) from '[.]([A-Za-z0-9]+)$')) ${sql.raw(
  Object.entries(CONTENT_TYPE_BY_EXTENSION)
    .map(([ext, type]) => `when '${ext}' then '${type}'`)
    .join(' '),
)} end)`

/** Images and videos by MIME prefix; "document" is everything else (PDFs, text, files with no type). */
export function fileTypeWhere(fileType: MediaFileType) {
  if (fileType !== 'document') return sql`${typeOf} ilike ${`${fileType}/%`}`
  return sql`coalesce(${typeOf}, '') not ilike 'image/%' and coalesce(${typeOf}, '') not ilike 'video/%'`
}

const kindOf = sql<MediaFileType>`case when ${typeOf} ilike 'image/%' then 'image' when ${typeOf} ilike 'video/%' then 'video' else 'document' end`

/**
 * What the Files storage page shows: bytes and file count per type (images, videos,
 * documents) over ready media, and the largest files with how many products use each.
 */
export async function mediaUsage(tx: StoreTx, largest = 4) {
  const [byKind, biggest] = await Promise.all([
    tx
      .select({
        kind: kindOf,
        files: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${media.size}), 0)::bigint`,
      })
      .from(media)
      .where(eq(media.status, 'ready'))
      .groupBy(kindOf),
    tx
      .select({
        id: media.id,
        key: media.key,
        contentType: media.contentType,
        size: media.size,
        createdAt: media.createdAt,
        kind: kindOf,
        usedBy: sql<number>`(select count(*)::int from product_media pm where pm.media_id = media.id)`,
      })
      .from(media)
      .where(and(eq(media.status, 'ready'), isNotNull(media.size)))
      .orderBy(desc(media.size), desc(media.id))
      .limit(largest),
  ])
  const sum = (kind: MediaFileType) => {
    const row = byKind.find((r) => r.kind === kind)
    return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) }
  }
  const image = sum('image')
  const video = sum('video')
  const document = sum('document')
  return {
    files: image.files + video.files + document.files,
    totalBytes: image.bytes + video.bytes + document.bytes,
    image,
    video,
    document,
    largest: biggest,
  }
}
