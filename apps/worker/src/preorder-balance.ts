import { parsePaymentSettings, resolvePaymentProviders, runBalanceSchedule } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, storesWithBalanceDue, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, PREORDER_BALANCE_QUEUE, Queue, Worker } from '@commerce/queue'
import { eq } from 'drizzle-orm'

/** Reminders and deadlines are in days; a minute of slack is plenty. */
export const BALANCE_EVERY_MS = 60_000

/**
 * One repeat job walks every store with pre-order balances owed: automatic
 * balance requests, up to two reminders, and the store's unpaid-balance rule
 * (cancel and refund, or cancel and keep the deposit). Each step is a
 * conditional update under the order's row lock, so an overlapping tick is
 * harmless. One store failing is logged and skipped.
 */
export function createPreorderBalanceJob(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue(PREORDER_BALANCE_QUEUE, { connection })
  const worker = new Worker(
    PREORDER_BALANCE_QUEUE,
    async () => {
      const storeIds = await storesWithBalanceDue(db)
      const counts = { requested: 0, reminded: 0, cancelled: 0, paid: 0 }
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
          for (const r of await runBalanceSchedule(db, storeId, providers)) {
            if (r.result === 'skipped') {
              if (r.reason) {
                logger.warn('preorder balance skipped', {
                  storeId,
                  orderId: r.orderId,
                  reason: r.reason,
                })
              }
            } else {
              counts[r.result] += 1
            }
          }
        } catch (err) {
          logger.warn('preorder balance failed', { storeId, error: err })
        }
      }
      if (Object.values(counts).some(Boolean)) logger.info('preorder balances processed', counts)
      return { stores: storeIds.length, ...counts }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
