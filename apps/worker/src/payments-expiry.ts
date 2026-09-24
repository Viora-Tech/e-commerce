import { expireUnpaidOrders, parsePaymentSettings, resolvePaymentProviders } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithUnpaidOnlineOrders, withStore } from '@commerce/db'
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
            const [s] = await tx
              .select({ payments: store.payments })
              .from(store)
              .where(eq(store.id, storeId))
            const { payments } = await registriesForStore(tx, storeId)
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
              console.warn(`[expiry] ${storeId}/${r.orderId} skipped: ${r.reason}`)
            }
          }
        } catch (err) {
          console.warn(`[expiry] store ${storeId} failed:`, err)
        }
      }
      if (cancelled || paid) console.log(`[expiry] cancelled=${cancelled} paid=${paid}`)
      return { stores: storeIds.length, cancelled, paid }
    },
    { connection },
  )
  return { queue, worker }
}
