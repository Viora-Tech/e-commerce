import { type Db, storesWithShopifyConnections, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { migrateSavedAppToken } from '@commerce/plugin-shopify-import/server'
import {
  type IORedis,
  KEEP_FINISHED,
  Queue,
  SHOPIFY_TOKEN_SWEEP_QUEUE,
  Worker,
} from '@commerce/queue'

export const SHOPIFY_TOKEN_SWEEP_EVERY_MS = 24 * 60 * 60_000

/**
 * Shopify stops accepting non-expiring offline tokens from public apps in 2027. Once a day,
 * every store whose Koomerce app connection still holds one has it swapped for an expiring
 * token (`migrateSavedAppToken`), so a store that never imports again is migrated too.
 */
export function createShopifyTokenSweep(
  connection: IORedis,
  db: Db,
  config: { settingsSecret: string },
) {
  const queue = new Queue(SHOPIFY_TOKEN_SWEEP_QUEUE, { connection })
  const worker = new Worker(
    SHOPIFY_TOKEN_SWEEP_QUEUE,
    async () => {
      let migrated = 0
      let failed = 0
      for (const storeId of await storesWithShopifyConnections(db)) {
        const result = await withStore(db, storeId, (tx) =>
          migrateSavedAppToken(tx, config.settingsSecret),
        ).catch(() => 'failed' as const)
        if (result === 'migrated') migrated++
        if (result === 'failed') {
          failed++
          logger.warn('shopify token migration failed', { area: 'shopify-import', storeId })
        }
      }
      if (migrated) logger.info('shopify tokens migrated', { area: 'shopify-import', migrated })
      return { migrated, failed }
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
