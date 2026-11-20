import 'server-only'

import { compactVideosByUrl } from '@commerce/core'
import { media, type StoreTx } from '@commerce/db'
import { and, inArray, isNotNull } from 'drizzle-orm'
import { digest } from './liquid-cache'
import {
  collectImageUrls,
  collectVideoUrls,
  collectVideosWithoutPoster,
  type ImageMedia,
  MAX_LOOKUP_URLS,
  type PosterImage,
  withImageMedia,
  withSmallVideos,
  withVideoPosters,
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

/** Each video's poster picture in Files (with its variants), keyed by the video's address. */
export async function postersByVideoUrl(
  tx: StoreTx,
  urls: readonly string[],
): Promise<Map<string, PosterImage>> {
  const wanted = urls.slice(0, MAX_LOOKUP_URLS)
  if (wanted.length === 0) return new Map()
  const videos = await tx
    .select({ url: media.url, posterId: media.posterMediaId })
    .from(media)
    .where(and(inArray(media.url, wanted), isNotNull(media.posterMediaId)))
  const ids = [...new Set(videos.map((v) => v.posterId).filter((id): id is string => !!id))]
  if (ids.length === 0) return new Map()
  const posters = await tx
    .select({
      id: media.id,
      url: media.url,
      variants: media.variants,
      thumbhash: media.thumbhash,
      width: media.width,
      height: media.height,
    })
    .from(media)
    .where(inArray(media.id, ids))
  const byId = new Map(posters.map((p) => [p.id, p]))
  const out = new Map<string, PosterImage>()
  for (const v of videos) {
    const p = v.posterId ? byId.get(v.posterId) : undefined
    if (!p) continue
    out.set(v.url, {
      url: p.url,
      variants: p.variants as ImageMedia['variants'],
      thumbhash: p.thumbhash,
      width: p.width,
      height: p.height,
    })
  }
  return out
}

/**
 * `value` with every section image the media library knows carrying its variants, every
 * empty video poster filled with the video's poster from Files, and every video playing its
 * smaller copy once the worker has made it (the original until then). Cached per
 * store version, except in a theme preview (`fresh`), which reads the library as it is.
 */
export async function attachImageMedia<T>(storeId: string, input: T, fresh: boolean): Promise<T> {
  let value = input
  const videos = collectVideosWithoutPoster(value)
  if (videos.length > 0) {
    const readPosters = (tx: StoreTx) => postersByVideoUrl(tx, videos)
    const posters = fresh
      ? await inStore(storeId, readPosters)
      : await storeRead(storeId, `posters|${digest(videos)}`, readPosters)
    value = withVideoPosters(value, posters)
  }
  // After the posters, which are found by the original's address.
  const videoUrls = collectVideoUrls(value)
  if (videoUrls.length > 0) {
    const readCopies = (tx: StoreTx) => compactVideosByUrl(tx, videoUrls)
    const copies = fresh
      ? await inStore(storeId, readCopies)
      : await storeRead(storeId, `small-videos|${digest(videoUrls)}`, readCopies)
    value = withSmallVideos(value, copies)
  }
  const urls = collectImageUrls(value)
  if (urls.length === 0) return value
  const read = (tx: StoreTx) => mediaByUrl(tx, urls)
  const found = fresh
    ? await inStore(storeId, read)
    : await storeRead(storeId, `media|${digest(urls)}`, read)
  return withImageMedia(value, found)
}
