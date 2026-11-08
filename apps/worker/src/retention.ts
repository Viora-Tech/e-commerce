import { runRetentionJob } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

export { RETENTION_SCHEDULE } from '@commerce/core'

/**
 * Nightly at 03:30 India time, every store: carts past retention are deleted (no contact or
 * converted after 30 days, with an email or phone after 90), dispatched outbox rows after 30
 * days, and gateway and courier webhook payloads are emptied after 180 days
 * (`runRetentionJob`). 500 rows per statement, each batch committed on its own.
 */
export function createRetentionPrune(db: Db) {
  const run = async () => {
    const r = await runRetentionJob(db, new Date(), {
      log: (m) => logger.warn(m, { area: 'retention' }),
    })
    if (r.carts || r.outboxEvents || r.paymentPayloads || r.shipmentPayloads || r.discoveryEvents) {
      logger.info('retention pruned', { area: 'retention', ...r })
    }
    return r
  }
  return { run }
}
