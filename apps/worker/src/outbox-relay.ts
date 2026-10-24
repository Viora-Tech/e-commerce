import { loadEnv } from '@commerce/config'
import {
  type AppEventQueue,
  type DomainRouteQueue,
  type InventoryRestockQueue,
  type NotificationQueue,
  type OutboxRelayDeps,
  relayStoreOutbox,
} from '@commerce/core'
import type { AutomationTriggerQueue } from '@commerce/core/automations/server'
import type { PixelOrderQueue } from '@commerce/core/pixels/server'
import { getRegistries } from '@commerce/core/registries'
import { type Db, storesWithUndispatchedOutboxEvents } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  createAppJobQueue,
  type IORedis,
  KEEP_FINISHED,
  OUTBOX_RELAY_QUEUE,
  type OutboxRelayJob,
  Queue,
  Worker,
} from '@commerce/queue'

// The producer side (`OutboxRelayJob`, `nudgeOutboxRelay`) lives in
// @commerce/queue so any app, not just the worker, can nudge the relay after
// a commit; re-exported here so existing worker imports keep working.
export { nudgeOutboxRelay } from '@commerce/queue'
export type { OutboxRelayJob }

/** How often the sweep looks for undispatched rows across every store. */
export const RELAY_EVERY_MS = 5_000

/**
 * One repeat job walks every store with undispatched outbox rows and fans
 * each row out to its notification and app-hook consumers (see
 * `relayStoreOutbox`). One store failing (a bad row, a transient DB error) is
 * logged and skipped; the next tick tries again. Also accepts a one-off
 * `{ storeId }` job so an interactive admin action can nudge its own store's
 * rows out sooner than the next sweep, without waiting on every other store.
 *
 * `catalog.products_changed` rows become app jobs (the Meilisearch app's index sync) on the
 * relay's own `{apps}-jobs` producer.
 *
 * Pattern from Trigger.dev's event log and Temporal's workflow history
 * (credited in `outbox/write.ts`): a durable poll-and-fan-out relay, not a
 * message broker.
 */
export function createOutboxRelay(
  connection: IORedis,
  db: Db,
  opts: {
    notifications: NotificationQueue
    appEvents?: AppEventQueue | undefined
    inventoryRestock?: InventoryRestockQueue | undefined
    domainRoutes?: DomainRouteQueue | undefined
    automationTriggers?: AutomationTriggerQueue | undefined
    pixelOrders?: PixelOrderQueue | undefined
  },
) {
  const appJobs = createAppJobQueue(connection)
  const deps: OutboxRelayDeps = {
    db,
    plugins: getRegistries(),
    notifications: opts.notifications,
    appEvents: opts.appEvents,
    inventoryRestock: opts.inventoryRestock,
    domainRoutes: opts.domainRoutes,
    automationTriggers: opts.automationTriggers,
    pixelOrders: opts.pixelOrders,
    appJobs,
    salesStoreId: loadEnv(process.env).PLATFORM_SALES_STORE_ID,
    log: (message) => logger.info(message, { area: 'outbox' }),
  }
  const queue = new Queue<OutboxRelayJob>(OUTBOX_RELAY_QUEUE, { connection })
  const worker = new Worker<OutboxRelayJob>(
    OUTBOX_RELAY_QUEUE,
    async (job) => {
      const storeIds = job.data.storeId
        ? [job.data.storeId]
        : await storesWithUndispatchedOutboxEvents(db)
      let dispatched = 0
      let failed = 0
      for (const storeId of storeIds) {
        try {
          const r = await relayStoreOutbox(deps, storeId)
          dispatched += r.dispatched
          failed += r.failed
        } catch (err) {
          logger.warn('outbox relay failed', { storeId, error: err })
        }
      }
      if (dispatched || failed) logger.info('outbox relayed', { dispatched, failed })
      return { stores: storeIds.length, dispatched, failed }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker, appJobs }
}
