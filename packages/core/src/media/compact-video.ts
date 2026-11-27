/** SOURCE OF TRUTH: smaller video copies — WHAT: which videos get a smaller copy, where it is stored, how the job is queued and how the storefront finds it / WHY: Waimers' hero videos were 16-34 MB straight from the merchant's export and took seconds to start (owner, 17-18 Nov 2026); Shopify serves re-encoded renditions, we keep one smaller H.264 copy per video */
import type { StoreTx } from '@commerce/db'
import { media } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
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

/**
 * A video's first-frame poster (Shopify's `preview_images/<id>.thumbnail.0000000000.jpg`): a light
 * WebP beside the video, made by the same worker job as the smaller copy. The storefront paints
 * it before the video plays, so the hero's LCP is a ~50 KB picture instead of a 5-9 MB video
 * (owner, 25 Nov 2026: LCP 5.1 s on www.waimers.in). It is the video's own poster row
 * (`poster_media_id`) only when the merchant has none: a poster the merchant or the admin's
 * upload grab chose always wins and is never replaced.
 * `stores/x/media/abc-hero.mp4` → `stores/x/media/abc-hero.poster.webp`.
 */
export function videoPosterKey(key: string): string {
  return `${key.replace(/\.[a-z0-9]{2,5}$/i, '')}.poster.webp`
}

/** A landscape (or square) video's poster is at most this wide: a full-bleed desktop hero. */
export const POSTER_WIDTH = 1280

/** A portrait video's poster (a phone's hero source) is at most this wide. */
export const POSTER_PORTRAIT_WIDTH = 750

/** How wide a poster is made for a frame of `width` × `height` (never wider than the frame). */
export function posterWidthFor(width: number, height: number): number {
  const cap = height > width ? POSTER_PORTRAIT_WIDTH : POSTER_WIDTH
  return Math.min(cap, width)
}

/** A poster above this many bytes is encoded again at a lower quality (aim: 30-60 KB). */
export const POSTER_MAX_BYTES = 60 * 1024

/** WebP qualities tried in turn until the poster fits `POSTER_MAX_BYTES` (the last is kept). */
export const POSTER_QUALITIES = [62, 48, 36] as const

/**
 * Saves a made poster as a picture in Files and links it to the video, only if the video still
 * has no poster (a merchant's pick made meanwhile wins). A picture already at that address is
 * reused, so a re-run adds no second row. Returns the poster's id, or null when the video already
 * had a poster.
 */
export async function linkAutoPoster(
  tx: StoreTx,
  storeId: string,
  videoId: string,
  poster: {
    url: string
    key: string
    provider: string
    size: number
    width: number | null
    height: number | null
  },
): Promise<string | null> {
  const [video] = await tx
    .select({ posterId: media.posterMediaId })
    .from(media)
    .where(eq(media.id, videoId))
  if (!video || video.posterId) return null
  const [existing] = await tx
    .select({ id: media.id })
    .from(media)
    .where(eq(media.url, poster.url))
    .limit(1)
  const posterId =
    existing?.id ??
    (
      await tx
        .insert(media)
        .values({
          storeId,
          url: poster.url,
          key: poster.key,
          provider: poster.provider,
          contentType: 'image/webp',
          size: poster.size,
          width: poster.width,
          height: poster.height,
          status: 'ready',
          processedAt: new Date(),
        })
        .returning({ id: media.id })
    )[0]?.id
  if (!posterId) return null
  const linked = await tx
    .update(media)
    .set({ posterMediaId: posterId })
    .where(and(eq(media.id, videoId), isNull(media.posterMediaId)))
    .returning({ id: media.id })
  return linked.length > 0 ? posterId : null
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
  height?: number | null | undefined
}

/**
 * The copy's encode settings. A landscape video keeps #1783's (1080p wide, CRF 26, capped near
 * 3.5 Mbps). A portrait video is a phone's hero source (a theme's mobile video): it plays on a
 * phone only, so its copy is at most 720 wide, CRF 28, capped near 1 Mbps (Waimers' phone hero
 * copy was 4.7 MB at the landscape settings, 27 Nov 2026; this aims at 1 to 1.5 MB for a clip of
 * about ten seconds).
 */
export type CopyShape = {
  maxWidth: number
  crf: number
  maxrateKbps: number
  /** At or under this bitrate (and no wider than `maxWidth`) the original is already lean. */
  leanBps: number
}

export const LANDSCAPE_COPY: CopyShape = {
  maxWidth: COMPACT_MAX_WIDTH,
  crf: 26,
  maxrateKbps: 3500,
  leanBps: LOW_BITRATE_BPS,
}

const PORTRAIT_COPY: CopyShape = {
  maxWidth: 720,
  crf: 28,
  maxrateKbps: 1000,
  leanBps: 1_200_000,
}

/** Portrait (taller than wide) gets the phone settings; unknown or landscape, the usual ones. */
export function copyShapeFor(probe: Pick<VideoProbe, 'width' | 'height'>): CopyShape {
  const { width, height } = probe
  return width && height && height > width ? PORTRAIT_COPY : LANDSCAPE_COPY
}

/**
 * Whether to encode a copy: `small` under `SMALL_VIDEO_BYTES`, `lean` when its bitrate is already
 * at or under its shape's `leanBps` and it is no wider than the copy would be. Unknown duration
 * or width never skips (the encode then decides, through `worthKeeping`).
 */
export function compactPlan(probe: VideoProbe): 'encode' | 'small' | 'lean' {
  if (probe.bytes < SMALL_VIDEO_BYTES) return 'small'
  const { durationSec, width } = probe
  const shape = copyShapeFor(probe)
  if (durationSec && durationSec > 0 && width && width <= shape.maxWidth) {
    const bitrate = (probe.bytes * 8) / durationSec
    if (bitrate <= shape.leanBps) return 'lean'
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
 * `process_error` of a file whose object is gone from its bucket. The row stays in Files (so the
 * merchant sees it and can delete it), and no sweep looks at it again.
 */
export const MEDIA_MISSING_ERROR = 'File missing from storage'

/**
 * Records that the file's object is missing: looked at for a copy (`NO_COPY_SIZE`) with the
 * missing error, so the hourly video sweep and `bun run media:videos` stop retrying it. A
 * `--force` run looks again, and a replace or re-process clears `process_error`.
 */
export async function markMediaMissing(tx: StoreTx, id: string): Promise<void> {
  await tx
    .update(media)
    .set({
      compactUrl: null,
      compactKey: null,
      compactSize: NO_COPY_SIZE,
      processError: MEDIA_MISSING_ERROR,
      processedAt: new Date(),
    })
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
