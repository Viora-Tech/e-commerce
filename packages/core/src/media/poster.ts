/** SOURCE OF TRUTH: video posters — WHAT: link a video in Files to its poster picture, and find the poster for a video by its address / WHY: a video's first frame is often black (Waimers' hero videos, 16 Nov 2026), so the admin grabs the first frame that is not black when a video is uploaded (opening shot, owner 21 Nov 2026) (`apps/admin/src/lib/video-poster.ts`) and Customize fills a video setting's poster from here */
import type { StoreTx } from '@commerce/db'
import { media } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { CommerceError } from '../errors'

export type VideoPoster = { url: string; width: number | null; height: number | null }

/** Sets (or clears, with null) a video's poster: the video must be a video, the poster an image. */
export async function setVideoPoster(tx: StoreTx, videoId: string, posterId: string | null) {
  const [video] = await tx
    .select({ id: media.id, contentType: media.contentType })
    .from(media)
    .where(eq(media.id, videoId))
  if (!video) throw new CommerceError('NOT_FOUND', 'Video not found')
  if (!video.contentType?.startsWith('video/')) {
    throw new CommerceError('BAD_REQUEST', 'Only a video can have a poster')
  }
  if (posterId) {
    const [poster] = await tx
      .select({ contentType: media.contentType })
      .from(media)
      .where(eq(media.id, posterId))
    if (!poster) throw new CommerceError('NOT_FOUND', 'Poster picture not found')
    if (!poster.contentType?.startsWith('image/')) {
      throw new CommerceError('BAD_REQUEST', 'A poster must be a picture')
    }
  }
  const [row] = await tx
    .update(media)
    .set({ posterMediaId: posterId })
    .where(eq(media.id, videoId))
    .returning()
  if (!row) throw new CommerceError('NOT_FOUND', 'Video not found')
  return row
}

/** The poster of the video in Files at this address, or null (not ours, or no poster yet). */
export async function videoPosterByUrl(tx: StoreTx, url: string): Promise<VideoPoster | null> {
  const [video] = await tx
    .select({ posterId: media.posterMediaId })
    .from(media)
    .where(eq(media.url, url))
    .limit(1)
  if (!video?.posterId) return null
  const [poster] = await tx
    .select({ url: media.url, width: media.width, height: media.height })
    .from(media)
    .where(eq(media.id, video.posterId))
  return poster ?? null
}
