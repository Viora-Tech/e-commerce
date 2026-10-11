import 'server-only'

import { media, type StoreTx } from '@commerce/db'
import { inArray } from 'drizzle-orm'
import { digest } from './liquid-cache'
import {
  collectImageUrls,
  type ImageMedia,
  MAX_LOOKUP_URLS,
  withImageMedia,
} from './section-images'
import { storeRead } from './store-cache'
import { inStore } from './store-context'

/** Variants, ThumbHash and size for media-library URLs, in one query under the store's RLS. */
export async function mediaByUrl(
  tx: StoreTx,
  urls: readonly string[],
): Promise<Map<string, ImageMedia>> {
  const wanted = urls.slice(0, MAX_LOOKUP_URLS)
  if (wanted.length === 0) return new Map()
  const rows = await tx
    .select({
      url: media.url,
      variants: media.variants,
      thumbhash: media.thumbhash,
      width: media.width,
      height: media.height,
    })
    .from(media)
    .where(inArray(media.url, wanted))
  return new Map(
    rows.map((r) => [
      r.url,
      {
        variants: r.variants as ImageMedia['variants'],
        thumbhash: r.thumbhash,
        width: r.width,
        height: r.height,
      },
    ]),
  )
}

/**
 * `value` with every section image the media library knows carrying its variants. Cached per
 * store version, except in a theme preview (`fresh`), which reads the library as it is.
 */
export async function attachImageMedia<T>(storeId: string, value: T, fresh: boolean): Promise<T> {
  const urls = collectImageUrls(value)
  if (urls.length === 0) return value
  const read = (tx: StoreTx) => mediaByUrl(tx, urls)
  const found = fresh
    ? await inStore(storeId, read)
    : await storeRead(storeId, `media|${digest(urls)}`, read)
  return withImageMedia(value, found)
}
