import { ROLLOUTS_QUEUE, runRolloutsTick } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export { ROLLOUTS_EVERY_MS } from '@commerce/core'

/**
 * Every minute: scheduled rollouts whose time came start, and events whose end passed roll back
 * or stay by their end action (`runRolloutsTick`), each store's rollout in its own transaction.
 */
export function createRolloutsTick(connection: IORedis, db: Db) {
  const queue = new Queue(ROLLOUTS_QUEUE, { connection })
  const worker = new Worker(
    ROLLOUTS_QUEUE,
    async () => {
      const r = await runRolloutsTick(db, new Date(), {
        log: (m) => logger.warn(m, { area: 'rollouts' }),
      })
      if (r.started || r.ended || r.failed)
        logger.info('rollouts ticked', { area: 'rollouts', ...r })
      return r
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
