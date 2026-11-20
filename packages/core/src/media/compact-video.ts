/** SOURCE OF TRUTH: smaller video copies — WHAT: which videos get a smaller copy, where it is stored, how the job is queued and how the storefront finds it / WHY: Waimers' hero videos were 16-34 MB straight from the merchant's export and took seconds to start (owner, 17-18 Nov 2026); Shopify serves re-encoded renditions, we keep one smaller H.264 copy per video */
import type { StoreTx } from '@commerce/db'
import { media } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import type { MediaProcessJob, MediaProcessQueue } from './queue'

/** The job name for a video's copy, on the video queue (and on the media queue before it existed). */
export const COMPACT_VIDEO_JOB = 'video'

/** A copy that saves less than this share of the original is not kept: the original plays. */
export const MIN_SAVING = 0.2

/** Below this size a video is already small: no copy is made (saves a download and an encode). */
export const SMALL_VIDEO_BYTES = 4 * 1024 * 1024

/**
 * A video at or under this bitrate (whole file, bits per second) and no wider than the copy's
 * 1920 is already lean: the copy (CRF 26, capped near 3.5 Mbps) would rarely save `MIN_SAVING`.
 */
export const LOW_BITRATE_BPS = 2_500_000

/** The copy is at most this wide (`scale='min(1920,iw)'` in the worker's ffmpeg arguments). */
export const COMPACT_MAX_WIDTH = 1920

/**
 * `compact_size` of a video that was looked at and keeps playing its original: already small,
 * the copy was not smaller, or the copy failed every attempt. The backfill skips it.
 */
export const NO_COPY_SIZE = 0

/** Backfill jobs wait behind every merchant upload on the video queue (BullMQ: higher runs later). */
export const BACKFILL_PRIORITY = 10

/** At most this many addresses are looked up per page section. */
const MAX_LOOKUP = 50

/** Only MP4/QuickTime/WebM uploads are re-encoded (what browsers play in `<video>`). */
export function isCompactableVideo(contentType: string | null | undefined): boolean {
  return /^video\/(mp4|quicktime|webm|x-m4v)$/i.test(contentType ?? '')
}

/** An address that names an MP4/MOV/M4V/WebM file (query string allowed). */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url)
}

/** `stores/x/media/abc-hero.mp4` → `stores/x/media/abc-hero.small.mp4`. */
export function compactVideoKey(key: string): string {
  return `${key.replace(/\.[a-z0-9]{2,5}$/i, '')}.small.mp4`
}

/** Whether a copy of `compactBytes` is worth keeping next to an original of `originalBytes`. */
export function worthKeeping(originalBytes: number, compactBytes: number): boolean {
  return compactBytes > 0 && compactBytes <= originalBytes * (1 - MIN_SAVING)
}

/** What ffprobe says about the original (any field may be missing for an odd file). */
export type VideoProbe = {
  bytes: number
  durationSec?: number | null | undefined
  width?: number | null | undefined
}

/**
 * Whether to encode a copy: `small` under `SMALL_VIDEO_BYTES`, `lean` when its bitrate is already
 * at or under `LOW_BITRATE_BPS` and it is no wider than the copy would be. Unknown duration or
 * width never skips (the encode then decides, through `worthKeeping`).
 */
export function compactPlan(probe: VideoProbe): 'encode' | 'small' | 'lean' {
  if (probe.bytes < SMALL_VIDEO_BYTES) return 'small'
  const { durationSec, width } = probe
  if (durationSec && durationSec > 0 && width && width <= COMPACT_MAX_WIDTH) {
    const bitrate = (probe.bytes * 8) / durationSec
    if (bitrate <= LOW_BITRATE_BPS) return 'lean'
  }
  return 'encode'
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

/** Records that a video keeps its original (see `NO_COPY_SIZE`); clears any older copy's address. */
export async function markVideoNoCopy(tx: StoreTx, id: string): Promise<void> {
  await tx
    .update(media)
    .set({ compactUrl: null, compactKey: null, compactSize: NO_COPY_SIZE })
    .where(eq(media.id, id))
}

/**
 * Queues the smaller copy for one video on the video queue (`{media}-video`, one encode at a
 * time), job id `<mediaId>-video` so a repeat is a no-op. `backfill` puts it behind every
 * upload. Never throws: the video plays its original without it, and the hourly backfill sweep
 * (worker `media-video-backfill`) queues any copy that was never made.
 */
export async function enqueueCompactVideo(
  queue: MediaProcessQueue,
  job: MediaProcessJob,
  opts: { backfill?: boolean } = {},
): Promise<void> {
  try {
    await queue.add(COMPACT_VIDEO_JOB, job, {
      jobId: `${job.mediaId}-video`,
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
      ...(opts.backfill ? { priority: BACKFILL_PRIORITY } : {}),
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
    if (src && isVideoUrl(src)) out.push(src)
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
