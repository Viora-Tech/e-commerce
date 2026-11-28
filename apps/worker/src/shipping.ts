import {
  applyTracking,
  flagUntrackedShipment,
  listOpenShipments,
  parseShippingSettings,
  resolveShippingProviders,
  type ShipmentRow,
  untrackedCreatedShipment,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithOpenShipments, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { ShippingProvider, Tracking } from '@commerce/shipping'
import { eq } from 'drizzle-orm'

/** How often open shipments are polled: hourly (owner, 22 Nov 2026). Couriers update scans a few times a day. */
export const TRACK_EVERY_MS = 60 * 60_000

/** Waybills per batched call when the courier does not say (Delhivery says 50). */
const DEFAULT_TRACK_BATCH = 50

/** `items` in runs of at most `size`, in order. */
export function inBatches<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step))
  return out
}

/**
 * One repeat job walks every store with open shipments, asks each store's
 * courier for fresh tracking and records it. A courier that fails for one
 * store is logged and skipped; the next tick tries again.
 *
 * A courier with `trackMany` (Delhivery) is asked about up to `trackBatchSize` waybills per call:
 * one call per parcel ran into its rate limit (207 calls refused with 429 in 15 h, 27 Nov 2026).
 * A shipment it has no record of that is still "Label created" 30 minutes after booking gets a
 * note on its order for the merchant (order #2503: a refused booking saved as a shipment).
 */
export function createShippingTracker(
  db: Db,
  opts: { settingsSecret: string; now?: (() => Date) | undefined },
) {
  const now = opts.now ?? (() => new Date())

  const record = async (storeId: string, row: ShipmentRow, tracking: Tracking) => {
    const r = await withStore(db, storeId, (tx) => applyTracking({ storeId, tx }, row.id, tracking))
    if (r.becameDelivered) {
      logger.info('shipment delivered', { storeId, orderId: row.orderId, waybill: row.waybill })
    }
  }

  /** The courier has no record of it: say so on the order once it is past the grace. */
  const noRecord = async (storeId: string, row: ShipmentRow, provider: ShippingProvider) => {
    if (!untrackedCreatedShipment(row, now())) return
    const wrote = await withStore(db, storeId, (tx) =>
      flagUntrackedShipment({ storeId, tx }, row, provider.label),
    )
    if (wrote) {
      logger.warn('courier has no record of a booked shipment', {
        storeId,
        provider: provider.id,
        shipmentId: row.id,
        orderId: row.orderId,
      })
    }
  }

  /** Many waybills per call. A failed call skips its batch until the next tick. */
  const trackBatched = async (
    storeId: string,
    provider: ShippingProvider & Required<Pick<ShippingProvider, 'trackMany'>>,
    rows: ShipmentRow[],
  ): Promise<number> => {
    let updated = 0
    for (const batch of inBatches(rows, provider.trackBatchSize ?? DEFAULT_TRACK_BATCH)) {
      let answers: Map<string, Tracking | null>
      try {
        answers = await provider.trackMany(batch.map((r) => r.waybill))
      } catch (err) {
        logger.warn('shipment tracking failed', {
          storeId,
          provider: provider.id,
          waybills: batch.length,
          error: err,
        })
        continue
      }
      for (const row of batch) {
        try {
          const tracking = answers.get(row.waybill)
          if (tracking) {
            await record(storeId, row, tracking)
            updated += 1
          } else {
            await noRecord(storeId, row, provider)
          }
        } catch (err) {
          logger.warn('shipment tracking failed', {
            storeId,
            provider: provider.id,
            waybill: row.waybill,
            error: err,
          })
        }
      }
    }
    return updated
  }

  const run = async () => {
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
      for (const provider of providers) {
        // No feed to ask (India Post): the merchant sets the status by hand.
        if (provider.tracksManually) continue
        const rows = open.filter((row) => row.provider === provider.id)
        if (!rows.length) continue
        if (provider.trackMany) {
          updated += await trackBatched(
            storeId,
            provider as ShippingProvider & Required<Pick<ShippingProvider, 'trackMany'>>,
            rows,
          )
          continue
        }
        for (const row of rows) {
          try {
            await record(storeId, row, await provider.track(row.waybill))
            updated += 1
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
    }
    return { stores: storeIds.length, updated }
  }
  return { run }
}
