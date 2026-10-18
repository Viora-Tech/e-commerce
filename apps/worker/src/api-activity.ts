import { pruneApiActivity } from '@commerce/core'
import { type Db, storesWithOldApiActivity, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { API_ACTIVITY_PRUNE_QUEUE, type IORedis, Queue, Worker } from '@commerce/queue'

export const API_ACTIVITY_PRUNE_EVERY_MS = 24 * 60 * 60_000

/**
 * Settings → MCP & API → Activity keeps 90 days: once a day, each store with older rows has
 * them deleted (`pruneApiActivity`).
 */
export function createApiActivityPrune(connection: IORedis, db: Db) {
  const queue = new Queue(API_ACTIVITY_PRUNE_QUEUE, { connection })
  const worker = new Worker(
    API_ACTIVITY_PRUNE_QUEUE,
    async () => {
      const now = new Date()
      let deleted = 0
      for (const storeId of await storesWithOldApiActivity(db, now)) {
        deleted += await withStore(db, storeId, (tx) => pruneApiActivity({ tx, storeId }, now))
      }
      if (deleted) logger.info('api activity pruned', { area: 'api-access', deleted })
      return { deleted }
    },
    { connection, concurrency: 1 },
  )
  return { queue, worker }
}
