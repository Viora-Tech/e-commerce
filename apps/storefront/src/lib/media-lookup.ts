import 'server-only'

import { media, type StoreTx } from '@commerce/db'
import { inArray } from 'drizzle-orm'
import {
  collectImageUrls,
  type ImageMedia,
  MAX_LOOKUP_URLS,
  withImageMedia,
} from './section-images'

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

/** `value` with every section image the media library knows carrying its variants. */
export async function attachImageMedia<T>(tx: StoreTx, value: T): Promise<T> {
  const urls = collectImageUrls(value)
  if (urls.length === 0) return value
  return withImageMedia(value, await mediaByUrl(tx, urls))
}
