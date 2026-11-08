import { refreshExchangeRates } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

export { FX_RATES_SCHEDULE } from '@commerce/core'

/**
 * Daily at 21:30 India time, once for the platform: the ECB's euro reference rates as units
 * per rupee, plus the dollar- and rupee-pegged currencies (`refreshExchangeRates`). Markets
 * without a fixed rate convert with the latest day. Also run once when the worker starts, so a
 * fresh deploy has rates before the first evening.
 */
export function createFxRates(db: Db) {
  const run = async () => {
    const r = await refreshExchangeRates(db)
    if ('problem' in r) logger.warn('exchange rates not refreshed', { area: 'fx', ...r })
    else logger.info('exchange rates refreshed', { area: 'fx', ...r })
    return r
  }
  return { run }
}
