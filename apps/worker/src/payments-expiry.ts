import {
  expireUnpaidOrders,
  parsePaymentSettings,
  refreshPaymentCredentials,
  resolvePaymentProviders,
  runManualFollowUp,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import {
  type Db,
  store,
  storesWithPendingManualOrders,
  storesWithUnpaidOnlineOrders,
  withStore,
} from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, Queue, UNPAID_EXPIRY_QUEUE, Worker } from '@commerce/queue'
import { eq } from 'drizzle-orm'

/** How often unpaid orders are checked. Windows are in minutes, so a minute of slack is fine. */
export const EXPIRY_EVERY_MS = 60_000

/**
 * One repeat job walks every store with placed online orders and expires the
 * ones past the store's "cancel unpaid orders after" window. The gateway is
 * asked first, so a late webhook never costs a paid order. One store failing
 * is logged and skipped; the next tick tries again. BullMQ runs one tick at a
 * time per scheduler, and each order is expired under its row lock, so an
 * overlapping run cannot release stock twice.
 *
 * The same tick runs the opt-in auto-cancel for manual UPI / bank transfer
 * orders (Settings › Payments, off by default): the merchant is told 12
 * hours ahead, then the order is cancelled. Shoppers are never reminded
 * automatically; the merchant sends that from the order.
 */
export function createUnpaidOrderExpiry(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue(UNPAID_EXPIRY_QUEUE, { connection })
  const worker = new Worker(
    UNPAID_EXPIRY_QUEUE,
    async () => {
      const storeIds = await storesWithUnpaidOnlineOrders(db)
      let cancelled = 0
      let paid = 0
      for (const storeId of storeIds) {
        try {
          const providers = await withStore(db, storeId, async (tx) => {
            const { payments } = await registriesForStore(tx, storeId)
            // Asking the gateway needs a live OAuth token; renew it first when due.
            await refreshPaymentCredentials({ storeId, tx }, payments, opts.settingsSecret)
            const [s] = await tx
              .select({ payments: store.payments })
              .from(store)
              .where(eq(store.id, storeId))
            return resolvePaymentProviders(
              payments,
              parsePaymentSettings(s?.payments),
              opts.settingsSecret,
            ).providers
          })
          for (const r of await expireUnpaidOrders(db, storeId, providers)) {
            if (r.result === 'cancelled') cancelled += 1
            if (r.result === 'paid') paid += 1
            if (r.result === 'skipped') {
              logger.warn('unpaid order expiry skipped', {
                storeId,
                orderId: r.orderId,
                reason: r.reason,
              })
            }
          }
        } catch (err) {
          logger.warn('unpaid order expiry failed', { storeId, error: err })
        }
      }
      if (cancelled || paid) logger.info('unpaid orders expired', { cancelled, paid })
      const transfers = await followUpManualTransfers(db)
      return { stores: storeIds.length, cancelled, paid, ...transfers }
    },
    { connection },
  )
  return { queue, worker }
}

/** Merchant notice then cancel for unpaid manual-transfer orders, in stores that opted in. */
async function followUpManualTransfers(db: Db) {
  let noticed = 0
  let transfersCancelled = 0
  for (const storeId of await storesWithPendingManualOrders(db)) {
    try {
      for (const r of await runManualFollowUp(db, storeId)) {
        if (r.result === 'noticed') noticed += 1
        if (r.result === 'cancelled') transfersCancelled += 1
        if (r.reason) {
          logger.warn('manual transfer follow-up skipped', {
            storeId,
            orderId: r.orderId,
            reason: r.reason,
          })
        }
      }
    } catch (err) {
      logger.warn('manual transfer follow-up failed', { storeId, error: err })
    }
  }
  if (noticed || transfersCancelled) {
    logger.info('manual transfers followed up', { noticed, cancelled: transfersCancelled })
  }
  return { noticed, transfersCancelled }
}
