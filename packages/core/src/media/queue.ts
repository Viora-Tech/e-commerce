/** SOURCE OF TRUTH: media processing job contract — WHAT the job shape producers enqueue / WHY @commerce/queue depends on core, not the other way */
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
 * Add one media row to the processing queue. `jobId: mediaId` makes a repeat
 * enqueue for the same media a no-op (BullMQ won't add a second job with the
 * same id while one is queued, active or kept as completed/failed), so every
 * producer (a retried confirm call, a re-run import) can call this freely.
 * Throws when the queue is unreachable; `enqueueMediaProcess` is the
 * never-throws variant.
 */
export async function addMediaProcessJob(
  queue: MediaProcessQueue,
  job: MediaProcessJob,
): Promise<void> {
  await queue.add('process', job, {
    jobId: job.mediaId,
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
  })
}

/**
 * Called right after `confirmUpload` returns a `processing` row. Same job id
 * scheme as `addMediaProcessJob`, so a flaky client retrying its confirm call
 * can't double-enqueue. Never throws: a Redis hiccup must not turn a
 * confirmed upload into an error page — the row is left `processing` and the
 * backfill script (`bun run media:reprocess`) sweeps up anything that never
 * got picked up.
 */
export async function enqueueMediaProcess(
  queue: MediaProcessQueue,
  job: MediaProcessJob,
): Promise<void> {
  try {
    await addMediaProcessJob(queue, job)
  } catch (err) {
    console.error(`[media] could not enqueue processing for ${job.mediaId}`, err)
  }
}
