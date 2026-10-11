/** SOURCE OF TRUTH: the "busy in the background" notice — WHAT: how many of a store's images still wait for processing, how fast they are finishing, and whether the admin should say the store may be slower (and for about how long) / WHY: image processing and imports share the server's CPU with the storefront; a merchant who sees a slow store should know why and that it ends */
import { media, type StoreTx } from '@commerce/db'
import { and, eq, gt, inArray, sql } from 'drizzle-orm'

/** Images waiting before the notice shows (fewer finish in a minute or two). */
const BACKGROUND_NOTICE_MIN_IMAGES = 50

/** The window the finishing rate is measured over. */
const RATE_WINDOW_MS = 10 * 60_000

/** Seconds an image takes when nothing finished recently to measure by (2 vCPU, one at a time). */
const FALLBACK_SECONDS_PER_IMAGE = 6

export type MediaBacklog = { waiting: number; finishedRecently: number }

/** Images not processed yet, and how many finished in the last ten minutes (store in scope). */
export async function mediaBacklog(tx: StoreTx, now: Date = new Date()): Promise<MediaBacklog> {
  const since = new Date(now.getTime() - RATE_WINDOW_MS)
  const [row] = await tx
    .select({
      // `pending` is an upload the browser never confirmed: nothing for the worker to do.
      waiting: sql<number>`count(*) filter (where ${eq(media.status, 'processing')})::int`,
      finishedRecently: sql<number>`count(*) filter (where ${and(
        inArray(media.status, ['ready', 'failed']),
        gt(media.processedAt, since),
      )})::int`,
    })
    .from(media)
  return { waiting: row?.waiting ?? 0, finishedRecently: row?.finishedRecently ?? 0 }
}

export type BackgroundWork = {
  /** Show the notice. */
  busy: boolean
  /** Images still to process. */
  images: number
  /** A Shopify import is writing products, images or files right now. */
  importing: boolean
  /** Rough minutes until the images are done; null with none waiting. */
  minutesLeft: number | null
}

/** Whether to tell the merchant the store may be slower, and for about how long. Pure. */
export function backgroundWork(backlog: MediaBacklog, importing: boolean): BackgroundWork {
  const images = backlog.waiting
  const perMinute = backlog.finishedRecently / (RATE_WINDOW_MS / 60_000)
  const minutesLeft =
    images === 0
      ? null
      : Math.max(
          1,
          Math.ceil(
            perMinute > 0 ? images / perMinute : (images * FALLBACK_SECONDS_PER_IMAGE) / 60,
          ),
        )
  return {
    busy: importing || images > BACKGROUND_NOTICE_MIN_IMAGES,
    images,
    importing,
    minutesLeft,
  }
}
