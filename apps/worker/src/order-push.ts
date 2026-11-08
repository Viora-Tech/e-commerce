import {
  cancelPushedOrders,
  parseShippingSettings,
  pushCouriers,
  pushPendingOrders,
  resolveShippingProviders,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithOrderPushCouriers, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { eq } from 'drizzle-orm'

/** How often new orders are sent. A merchant working from the courier's panel waits this long. */
export const PUSH_EVERY_MS = 5 * 60_000

/**
 * One repeat job walks every store with Shiprocket or RapidShyp enabled and sends their new
 * orders there as pending orders (`pushPendingOrders`), one store at a time. A store that fails
 * is logged and skipped; its orders are tried on the next tick.
 */
export function createOrderPusher(db: Db, opts: { settingsSecret: string }) {
  const run = async () => {
    const storeIds = await storesWithOrderPushCouriers(db)
    let pushed = 0
    let failed = 0
    for (const storeId of storeIds) {
      try {
        const r = await withStore(db, storeId, async (tx) => {
          const [s] = await tx
            .select({ shipping: store.shipping, name: store.name })
            .from(store)
            .where(eq(store.id, storeId))
          const settings = parseShippingSettings(s?.shipping)
          const registries = await registriesForStore(tx, storeId)
          const { providers } = resolveShippingProviders(
            registries.shipping,
            settings,
            opts.settingsSecret,
          )
          if (pushCouriers(providers).length === 0) return { pushed: 0, failed: 0 }
          // Cancelled here first, so a cancelled order is never left bookable there.
          await cancelPushedOrders({ storeId, tx }, providers)
          return pushPendingOrders({ storeId, tx }, providers, settings, s?.name ?? '')
        })
        pushed += r.pushed
        failed += r.failed
      } catch (err) {
        logger.warn('order push failed', { storeId, error: err })
      }
    }
    return { stores: storeIds.length, pushed, failed }
  }
  return { run }
}
