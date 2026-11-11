import { sweepExpiredStoreCredit } from '@commerce/core'
import { type Db, storesWithStoreCreditExpiring, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/**
 * Expiry is by the day, and money can never be spent past it anyway (every balance change takes
 * expired credit off first, and readers leave it out), so this only writes the history's
 * "Store credit expired" lines for accounts nobody touched. Hourly is plenty.
 */
export const STORE_CREDIT_EXPIRY_EVERY_MS = 60 * 60 * 1000

/** The sweep's name, which was never a queue of its own (the shared sweeps queue only). */
export const STORE_CREDIT_EXPIRY_QUEUE = 'store-credit-expiry'

/**
 * One repeat job finds every store with store credit past its expiry date and not yet taken off
 * (`stores_with_store_credit_expiring`, ids only) and, per store under RLS, writes each expiry
 * line under the account's row lock (`sweepExpiredStoreCredit`). A rerun or an overlap finds
 * nothing left to do: each credit line can expire once (unique `expired_entry_id`). One store
 * failing is logged and skipped; the next tick tries again.
 */
export function createStoreCreditExpiry(db: Db) {
  const run = async () => {
    const now = new Date()
    const storeIds = await storesWithStoreCreditExpiring(db, now)
    let customers = 0
    let expiredPaise = 0
    for (const storeId of storeIds) {
      try {
        const done = await withStore(db, storeId, (tx) =>
          sweepExpiredStoreCredit({ storeId, tx }, now),
        )
        customers += done.customers
        expiredPaise += done.expiredPaise
      } catch (err) {
        logger.warn('store credit expiry failed', { storeId, error: err })
      }
    }
    if (customers > 0) logger.info('store credit expired', { customers, expiredPaise })
    return { stores: storeIds.length, customers, expiredPaise }
  }
  return { run }
}
