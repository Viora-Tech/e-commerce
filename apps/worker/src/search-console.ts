import {
  enqueueAppJob,
  SEARCH_CONSOLE_APP_ID,
  SEARCH_CONSOLE_SYNC_JOB,
  storesDueSearchConsoleSync,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  createAppJobQueue,
  type IORedis,
  KEEP_FINISHED,
  Queue,
  SEARCH_CONSOLE_SWEEP_QUEUE,
  Worker,
} from '@commerce/queue'

/** How often stores due a sync are looked for; each store syncs about once a day. */
export const SEARCH_CONSOLE_EVERY_MS = 60 * 60_000

/**
 * Google Search Console app: one repeat job finds the stores with the app connected to a
 * property whose last sync try is over 20 hours old, and queues one app job each (the app's
 * `sync`, run by the app jobs worker, which reads Google and replaces the stored numbers). The
 * try is dated when the sync starts, so a store Google keeps refusing is retried the next day,
 * not every hour. One store failing to queue is logged and skipped.
 */
export function createSearchConsoleSweep(connection: IORedis, db: Db) {
  const queue = new Queue(SEARCH_CONSOLE_SWEEP_QUEUE, { connection })
  const appJobs = createAppJobQueue(connection)
  const worker = new Worker(
    SEARCH_CONSOLE_SWEEP_QUEUE,
    async () => {
      const storeIds = await storesDueSearchConsoleSync(db)
      let queued = 0
      for (const storeId of storeIds) {
        try {
          await enqueueAppJob(
            appJobs,
            { storeId, pluginId: SEARCH_CONSOLE_APP_ID, name: SEARCH_CONSOLE_SYNC_JOB, data: {} },
            SEARCH_CONSOLE_SYNC_JOB,
          )
          queued += 1
        } catch (err) {
          logger.warn('search console sync not queued', { storeId, error: err })
        }
      }
      if (queued) logger.info('search console syncs queued', { queued })
      return { stores: storeIds.length, queued }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker, appJobs }
}
