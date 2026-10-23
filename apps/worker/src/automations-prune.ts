import { AUTOMATION_PRUNE_QUEUE, runAutomationPruneJob } from '@commerce/core/automations/server'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export { AUTOMATION_PRUNE_EVERY_MS } from '@commerce/core/automations/server'

/**
 * Automations keep step detail 90 days and finished runs 13 months: once a day, each store with
 * older rows has them deleted (`pruneAutomationRuns`). Monthly usage rows are kept.
 */
export function createAutomationsPrune(connection: IORedis, db: Db) {
  const queue = new Queue(AUTOMATION_PRUNE_QUEUE, { connection })
  const worker = new Worker(
    AUTOMATION_PRUNE_QUEUE,
    async () => {
      const r = await runAutomationPruneJob(db, new Date(), (m) =>
        logger.warn(m, { area: 'automations' }),
      )
      if (r.steps || r.runs) logger.info('automations pruned', { area: 'automations', ...r })
      return r
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
