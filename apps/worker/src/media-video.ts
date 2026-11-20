/**
 * SOURCE OF TRUTH KEYWORDS: video queue, smaller video copies, video backfill
 * WHAT:  The worker for `{media}-video`: one smaller storefront copy per uploaded video
 *        (`./video-compact.ts`), and the hourly sweep that queues every video never looked at.
 * WHY:   #1783 made the copies, but only on confirm and by hand (`bun run media:videos`). Videos
 *        imported from Shopify or a theme zip, uploaded before #1783, or whose job was lost
 *        never got one. Owner roadmap, 20 Nov 2026: copies made automatically in the background.
 * Memory: one encode at a time across every worker process (`concurrency: 1` and the queue's
 *        global concurrency of 1), never beside an image encode (its own queue), and paused by
 *        the memory guard with the other bulk queues (`media-video` in `./memory-guard.ts`).
 */
import {
  COMPACT_VIDEO_JOB,
  enqueueCompactVideo,
  isCompactableVideo,
  markVideoNoCopy,
} from '@commerce/core'
import { type Db, media, storesWithVideosNeedingCopy, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  type IORedis,
  KEEP_FINISHED,
  MEDIA_VIDEO_QUEUE,
  type MediaProcessJob,
  type MediaProcessQueue,
  Queue,
  Worker,
} from '@commerce/queue'
import { and, asc, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import { compactVideo } from './video-compact'

/** Every hour: picks up imports and anything a lost job left behind; finds nothing once done. */
export const VIDEO_BACKFILL_EVERY_MS = 60 * 60_000

/** At most this many videos queued per store per sweep; the next sweep takes the rest. */
export const BACKFILL_PER_STORE = 50

/** A video this young is left to its own upload job (queued on confirm). */
const UPLOAD_GRACE_MS = 15 * 60_000

/** A 100 MB encode can pass ten minutes; BullMQ renews the lock while the job runs. */
const LOCK_MS = 5 * 60_000

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']

export function createMediaVideoWorker(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue<MediaProcessJob>(MEDIA_VIDEO_QUEUE, { connection })
  // One encode across every worker process, also while an old container finishes during a deploy.
  queue.setGlobalConcurrency(1).catch((err: unknown) => {
    logger.warn('could not set the video queue to one job at a time', { error: err })
  })
  const worker = new Worker<MediaProcessJob>(
    MEDIA_VIDEO_QUEUE,
    async (job) => {
      if (job.name !== COMPACT_VIDEO_JOB) return { unknown: 1 }
      const result = await compactVideo(db, job.data.storeId, job.data.mediaId, opts.settingsSecret)
      return { result }
    },
    { connection, concurrency: 1, lockDuration: LOCK_MS, ...KEEP_FINISHED },
  )

  // Every attempt failed: the original keeps playing, and the row is marked so no sweep retries
  // a broken file every hour. `bun run media:videos --force --store <slug>` tries it again.
  worker.on('failed', async (job, err) => {
    const maxAttempts = job?.opts.attempts ?? 1
    if (!job || job.attemptsMade < maxAttempts) return
    logger.warn('video copy failed, original kept', {
      storeId: job.data.storeId,
      mediaId: job.data.mediaId,
      error: err,
    })
    try {
      await withStore(db, job.data.storeId, (tx) => markVideoNoCopy(tx, job.data.mediaId))
    } catch (markErr) {
      logger.error('could not mark video copy failed', { mediaId: job.data.mediaId, error: markErr })
    }
  })

  return { queue, worker }
}

/** Ids of one store's videos never looked at for a copy, oldest first, older than the grace. */
async function videosNeedingCopy(db: Db, storeId: string, now: number): Promise<string[]> {
  const rows = await withStore(db, storeId, (tx) =>
    tx
      .select({ id: media.id, contentType: media.contentType })
      .from(media)
      .where(
        and(
          inArray(media.contentType, VIDEO_TYPES),
          isNull(media.compactSize),
          isNotNull(media.key),
          lt(media.createdAt, new Date(now - UPLOAD_GRACE_MS)),
        ),
      )
      .orderBy(asc(media.createdAt))
      .limit(BACKFILL_PER_STORE),
  )
  return rows.filter((r) => isCompactableVideo(r.contentType)).map((r) => r.id)
}

/**
 * The backfill sweep: queues each video never looked at, behind every upload (`backfill`
 * priority). Only queues: the encodes run one by one on the video worker. Re-queuing is a
 * no-op (job id `<mediaId>-video`), so an overlap or a rerun adds nothing.
 */
export function createVideoBackfill(db: Db, queue: MediaProcessQueue, now = Date.now) {
  const run = async () => {
    const storeIds = await storesWithVideosNeedingCopy(db)
    let queued = 0
    for (const storeId of storeIds) {
      try {
        for (const mediaId of await videosNeedingCopy(db, storeId, now())) {
          await enqueueCompactVideo(queue, { storeId, mediaId }, { backfill: true })
          queued++
        }
      } catch (err) {
        logger.warn('video backfill failed for a store', { storeId, error: err })
      }
    }
    if (queued > 0) logger.info('video copies queued', { stores: storeIds.length, queued })
    return { stores: storeIds.length, queued }
  }
  return { run }
}

/** Old `video` jobs left on the media queue from before the video queue: moved, not run there. */
export async function forwardVideoJob(queue: MediaProcessQueue, job: MediaProcessJob) {
  await enqueueCompactVideo(queue, { storeId: job.storeId, mediaId: job.mediaId })
}
