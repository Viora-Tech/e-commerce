import { pruneStoreActivity } from '@commerce/core'
import { type Db, storesWithOldStoreActivity, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  type IORedis,
  KEEP_FINISHED,
  Queue,
  STORE_ACTIVITY_PRUNE_QUEUE,
  Worker,
} from '@commerce/queue'

export const STORE_ACTIVITY_PRUNE_EVERY_MS = 24 * 60 * 60_000

/**
 * Settings → Activity log keeps a year: once a day, each store with older rows has them deleted
 * (`pruneStoreActivity`).
 */
export function createStoreActivityPrune(connection: IORedis, db: Db) {
  const queue = new Queue(STORE_ACTIVITY_PRUNE_QUEUE, { connection })
  const worker = new Worker(
    STORE_ACTIVITY_PRUNE_QUEUE,
    async () => {
      const now = new Date()
      let deleted = 0
      for (const storeId of await storesWithOldStoreActivity(db, now)) {
        deleted += await withStore(db, storeId, (tx) => pruneStoreActivity({ tx, storeId }, now))
      }
      if (deleted) logger.info('store activity pruned', { area: 'activity-log', deleted })
      return { deleted }
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
