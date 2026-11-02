import {
  expireUnpaidOrders,
  parsePaymentSettings,
  queuePaymentPendingNudges,
  refreshPaymentCredentials,
  releaseExpiredDraftHolds,
  resolvePaymentProviders,
  runCodConfirmationSweep,
  runManualFollowUp,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import {
  type Db,
  store,
  storesWithExpiredDraftHolds,
  storesWithPendingCodChecks,
  storesWithPendingManualOrders,
  storesWithUnpaidOnlineOrders,
  withStore,
} from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, UNPAID_EXPIRY_QUEUE, Worker } from '@commerce/queue'
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
 *
 * Before that, each store's unfinished online payments get their one "payment not finished"
 * nudge (`queuePaymentPendingNudges`), a few minutes after checkout.
 *
 * And the COD & RTO app's confirmation deadlines: COD orders nobody confirmed are flagged
 * for a call, and cancelled when the store turned auto-cancel on.
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
      let nudged = 0
      for (const storeId of storeIds) {
        // "Your payment did not go through" (once per order, with the retry link), before the
        // expiry below can cancel it. A failure here never stops the expiry.
        try {
          nudged += await withStore(db, storeId, (tx) => queuePaymentPendingNudges({ storeId, tx }))
        } catch (err) {
          logger.warn('payment pending nudge failed', { storeId, error: err })
        }
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
      if (nudged) logger.info('payment pending nudges queued', { nudged })
      const transfers = await followUpManualTransfers(db)
      const cod = await sweepCodConfirmations(db)
      const draftHoldsReleased = await releaseDraftHolds(db)
      return {
        stores: storeIds.length,
        cancelled,
        paid,
        nudged,
        ...transfers,
        ...cod,
        draftHoldsReleased,
      }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}

/** Drafts whose "reserve items" date passed (#1030) put their stock back on sale. */
async function releaseDraftHolds(db: Db) {
  let released = 0
  for (const storeId of await storesWithExpiredDraftHolds(db)) {
    try {
      released += await withStore(db, storeId, (tx) => releaseExpiredDraftHolds({ storeId, tx }))
    } catch (err) {
      logger.warn('draft hold release failed', { storeId, error: err })
    }
  }
  if (released) logger.info('draft holds released', { released })
  return released
}

/** COD orders past the store's confirmation deadlines: flagged, or cancelled when opted in. */
async function sweepCodConfirmations(db: Db) {
  let codFlagged = 0
  let codCancelled = 0
  for (const storeId of await storesWithPendingCodChecks(db)) {
    try {
      const r = await runCodConfirmationSweep(db, storeId)
      codFlagged += r.flagged
      codCancelled += r.cancelled
    } catch (err) {
      logger.warn('cod confirmation sweep failed', { storeId, error: err })
    }
  }
  if (codFlagged || codCancelled) {
    logger.info('cod confirmations swept', { flagged: codFlagged, cancelled: codCancelled })
  }
  return { codFlagged, codCancelled }
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
