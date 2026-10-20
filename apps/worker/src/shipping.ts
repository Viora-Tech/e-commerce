import {
  applyTracking,
  listOpenShipments,
  parseShippingSettings,
  resolveShippingProviders,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithOpenShipments, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, SHIPPING_TRACK_QUEUE, Worker } from '@commerce/queue'
import { eq } from 'drizzle-orm'

/** How often open shipments are polled. Couriers update scans a few times a day. */
export const TRACK_EVERY_MS = 30 * 60_000

/**
 * One repeat job walks every store with open shipments, asks each store's
 * courier for fresh tracking and records it. A courier that fails for one
 * store is logged and skipped; the next tick tries again.
 */
export function createShippingTracker(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue(SHIPPING_TRACK_QUEUE, { connection })
  const worker = new Worker(
    SHIPPING_TRACK_QUEUE,
    async () => {
      // Which stores have parcels in flight; every read after this is scoped to one store.
      const storeIds = await storesWithOpenShipments(db)
      let updated = 0
      for (const storeId of storeIds) {
        const { settings, open, registries } = await withStore(db, storeId, async (tx) => {
          const [s] = await tx
            .select({ shipping: store.shipping })
            .from(store)
            .where(eq(store.id, storeId))
          return {
            settings: parseShippingSettings(s?.shipping),
            open: await listOpenShipments({ storeId, tx }),
            registries: await registriesForStore(tx, storeId),
          }
        })
        const { providers } = resolveShippingProviders(
          registries.shipping,
          settings,
          opts.settingsSecret,
        )
        for (const row of open) {
          const provider = providers.find((p) => p.id === row.provider)
          // No feed to ask (India Post): the merchant sets the status by hand.
          if (!provider || provider.tracksManually) continue
          try {
            const tracking = await provider.track(row.waybill)
            const r = await withStore(db, storeId, (tx) =>
              applyTracking({ storeId, tx }, row.id, tracking),
            )
            updated += 1
            if (r.becameDelivered) {
              logger.info('shipment delivered', {
                storeId,
                orderId: row.orderId,
                waybill: row.waybill,
              })
            }
          } catch (err) {
            logger.warn('shipment tracking failed', {
              storeId,
              provider: row.provider,
              waybill: row.waybill,
              error: err,
            })
          }
        }
      }
      return { stores: storeIds.length, updated }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
