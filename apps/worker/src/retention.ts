import { RETENTION_QUEUE, runRetentionJob } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export { RETENTION_SCHEDULE } from '@commerce/core'

/**
 * Nightly at 03:30 India time, every store: carts past retention are deleted (no contact or
 * converted after 30 days, with an email or phone after 90), dispatched outbox rows after 30
 * days, and gateway and courier webhook payloads are emptied after 180 days
 * (`runRetentionJob`). 500 rows per statement, each batch committed on its own.
 */
export function createRetentionPrune(connection: IORedis, db: Db) {
  const queue = new Queue(RETENTION_QUEUE, { connection })
  const worker = new Worker(
    RETENTION_QUEUE,
    async () => {
      const r = await runRetentionJob(db, new Date(), {
        log: (m) => logger.warn(m, { area: 'retention' }),
      })
      if (
        r.carts ||
        r.outboxEvents ||
        r.paymentPayloads ||
        r.shipmentPayloads ||
        r.discoveryEvents
      ) {
        logger.info('retention pruned', { area: 'retention', ...r })
      }
      return r
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
