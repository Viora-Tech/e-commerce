import { runAutomationPruneJob } from '@commerce/core/automations/server'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

export { AUTOMATION_PRUNE_EVERY_MS } from '@commerce/core/automations/server'

/**
 * Automations keep step detail 90 days and finished runs 13 months: once a day, each store with
 * older rows has them deleted (`pruneAutomationRuns`). Monthly usage rows are kept.
 */
export function createAutomationsPrune(db: Db) {
  const run = async () => {
    const r = await runAutomationPruneJob(db, new Date(), (m) =>
      logger.warn(m, { area: 'automations' }),
    )
    if (r.steps || r.runs) logger.info('automations pruned', { area: 'automations', ...r })
    return r
  }
  return { run }
}
