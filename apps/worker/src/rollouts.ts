import { runRolloutsTick } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/**
 * Every minute: scheduled rollouts whose time came start, and events whose end passed roll back
 * or stay by their end action (`runRolloutsTick`), each store's rollout in its own transaction.
 */
export function createRolloutsTick(db: Db) {
  const run = async () => {
    const r = await runRolloutsTick(db, new Date(), {
      log: (m) => logger.warn(m, { area: 'rollouts' }),
    })
    if (r.started || r.ended || r.failed) logger.info('rollouts ticked', { area: 'rollouts', ...r })
    return r
  }
  return { run }
}
