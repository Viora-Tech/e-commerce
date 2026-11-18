/** SOURCE OF TRUTH: smaller video copies — WHAT: which videos get a smaller copy, where it is stored, how the job is queued and how the storefront finds it / WHY: Waimers' hero videos were 16-34 MB straight from the merchant's export and took seconds to start (owner, 17-18 Nov 2026); Shopify serves re-encoded renditions, we keep one smaller H.264 copy per video */
import type { StoreTx } from '@commerce/db'
import { media } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import type { MediaProcessJob, MediaProcessQueue } from './queue'

/** The job name on the media queue; the worker runs the video path for it, never the image one. */
export const COMPACT_VIDEO_JOB = 'video'

/** A copy that saves less than this share of the original is not kept: the original plays. */
export const MIN_SAVING = 0.2

/** At most this many addresses are looked up per page section. */
const MAX_LOOKUP = 50

/** Only MP4/QuickTime/WebM uploads are re-encoded (what browsers play in `<video>`). */
export function isCompactableVideo(contentType: string | null | undefined): boolean {
  return /^video\/(mp4|quicktime|webm|x-m4v)$/i.test(contentType ?? '')
}

/** `stores/x/media/abc-hero.mp4` → `stores/x/media/abc-hero.small.mp4`. */
export function compactVideoKey(key: string): string {
  return `${key.replace(/\.[a-z0-9]{2,5}$/i, '')}.small.mp4`
}

/** Whether a copy of `compactBytes` is worth keeping next to an original of `originalBytes`. */
export function worthKeeping(originalBytes: number, compactBytes: number): boolean {
  return compactBytes > 0 && compactBytes <= originalBytes * (1 - MIN_SAVING)
}

/** Saves the smaller copy on the video's row. */
export async function markVideoCompact(
  tx: StoreTx,
  id: string,
  copy: { url: string; key: string; size: number },
): Promise<void> {
  await tx
    .update(media)
    .set({ compactUrl: copy.url, compactKey: copy.key, compactSize: copy.size })
    .where(eq(media.id, id))
}

/**
 * Queues the smaller copy for one video on the media queue, under its own job name and id (the
 * image job of the same row, if any, keeps `mediaId`). Never throws: the video works without it,
 * and `bun run media:videos` makes any copy that was never queued.
 */
export async function enqueueCompactVideo(
  queue: MediaProcessQueue,
  job: MediaProcessJob,
): Promise<void> {
  try {
    await queue.add(COMPACT_VIDEO_JOB, job, {
      jobId: `${job.mediaId}-video`,
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
    })
  } catch (err) {
    logger.error('could not enqueue video copy', {
      storeId: job.storeId,
      mediaId: job.mediaId,
      error: err,
    })
  }
}

/** Each video in Files at one of these addresses that has a smaller copy: address → copy. */
export async function compactVideosByUrl(
  tx: StoreTx,
  urls: readonly string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(urls)].slice(0, MAX_LOOKUP)
  if (wanted.length === 0) return new Map()
  const rows = await tx
    .select({ url: media.url, compactUrl: media.compactUrl })
    .from(media)
    .where(and(inArray(media.url, wanted), isNotNull(media.compactUrl)))
  return new Map(rows.flatMap((r) => (r.compactUrl ? [[r.url, r.compactUrl] as const] : [])))
}

const VIDEO_TAG = /<(video|source)\b[^>]*>/gi
const SRC = /\bsrc\s*=\s*(["'])([^"']+)\1/i

/** The `src` of every `<video>` and `<source>` in `html` that points at an MP4/MOV/WebM file. */
export function videoSources(html: string): string[] {
  const out: string[] = []
  for (const tag of html.matchAll(VIDEO_TAG)) {
    const src = SRC.exec(tag[0])?.[2]
    if (src && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(src)) out.push(src)
  }
  return out
}

/** `html` with each video `src` that has a smaller copy pointing at the copy. */
export function withCompactVideos(html: string, copies: ReadonlyMap<string, string>): string {
  if (copies.size === 0) return html
  return html.replace(VIDEO_TAG, (tag) =>
    tag.replace(SRC, (whole, quote: string, src: string) => {
      const copy = copies.get(src)
      return copy ? `src=${quote}${copy}${quote}` : whole
    }),
  )
}
