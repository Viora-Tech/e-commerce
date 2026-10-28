import { FX_RATES_QUEUE, refreshExchangeRates } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export { FX_RATES_SCHEDULE } from '@commerce/core'

/**
 * Daily at 21:30 India time, once for the platform: the ECB's euro reference rates as units
 * per rupee, plus the dollar- and rupee-pegged currencies (`refreshExchangeRates`). Markets
 * without a fixed rate convert with the latest day. Also run once when the worker starts, so a
 * fresh deploy has rates before the first evening.
 */
export function createFxRates(connection: IORedis, db: Db) {
  const queue = new Queue(FX_RATES_QUEUE, { connection })
  const worker = new Worker(
    FX_RATES_QUEUE,
    async () => {
      const r = await refreshExchangeRates(db)
      if ('problem' in r) logger.warn('exchange rates not refreshed', { area: 'fx', ...r })
      else logger.info('exchange rates refreshed', { area: 'fx', ...r })
      return r
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
