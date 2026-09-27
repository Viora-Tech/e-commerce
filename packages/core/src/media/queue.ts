/**
 * Producer-side contract for the media-processing job. The concrete BullMQ
 * queue lives in `@commerce/queue` (which depends on this package, so the
 * dependency can't run the other way); this file only knows the shape,
 * mirroring `NotificationQueue`/`AppEventQueue` in `../plugins/events.ts`.
 */

export type MediaProcessJob = { storeId: string; mediaId: string }

export type MediaProcessQueue = {
  add(
    name: string,
    data: MediaProcessJob,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
    },
  ): Promise<unknown>
}

/**
 * Called right after `confirmUpload` returns a `processing` row. `jobId:
 * mediaId` makes a repeat enqueue for the same media a no-op (BullMQ won't
 * add a second job with the same id while one is queued/active), so a
 * flaky client retrying its confirm call can't double-enqueue. Never
 * throws: a Redis hiccup must not turn a confirmed upload into an error
 * page — the row is left `processing` and the backfill script
 * (`bun run media:reprocess`) sweeps up anything that never got picked up.
 */
export async function enqueueMediaProcess(
  queue: MediaProcessQueue,
  job: MediaProcessJob,
): Promise<void> {
  try {
    await queue.add('process', job, {
      jobId: job.mediaId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
    })
  } catch (err) {
    console.error(`[media] could not enqueue processing for ${job.mediaId}`, err)
  }
}
