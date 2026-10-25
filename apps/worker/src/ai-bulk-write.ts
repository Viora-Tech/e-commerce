import { AI_BULK_QUEUE, type AiBulkJob } from '@commerce/core'
import { runAiJob } from '@commerce/core/ai-runtime'
import type { Db } from '@commerce/db'
import {
  fairProcessor,
  type IORedis,
  KEEP_FINISHED,
  QUEUE_LIMITS,
  Queue,
  Worker,
} from '@commerce/queue'

/**
 * Bulk "Write with AI" (products list → select → Write with AI): one job per run. The runner
 * writes one product at a time, admitting and metering each call against the store's plan,
 * and stops early when the run is cancelled or the store runs out of allowance. Fair per
 * store (`QUEUE_LIMITS.aiBulkWrite`): a 200-product run never holds up another store's.
 * A crash mid-run is retried; items already written are kept, the rest pick up where it was.
 */
export function createAiBulkWriteWorker(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue<AiBulkJob>(AI_BULK_QUEUE, { connection })
  const worker = new Worker<AiBulkJob>(
    AI_BULK_QUEUE,
    fairProcessor(connection, AI_BULK_QUEUE, QUEUE_LIMITS.aiBulkWrite, async (job) => {
      const { storeId, jobId } = job.data
      // The job's wide event (`logWorkerJobs`) records the finished run with its storeId and jobId.
      await runAiJob({ db, storeId, jobId, settingsSecret: opts.settingsSecret })
    }),
    // A run can take minutes; keep the lock alive well past one product's model call.
    {
      connection,
      concurrency: QUEUE_LIMITS.aiBulkWrite.concurrency,
      lockDuration: 120_000,
      ...KEEP_FINISHED,
    },
  )
  return { queue, worker }
}
