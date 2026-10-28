import { resolveBillingEnv, runAppRenewals, runBillingSweep, runUsageBilling } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { BILLING_SWEEP_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

/** The sweep is idempotent, so hourly keeps renewals on time without double billing. */
export const BILLING_EVERY_MS = 60 * 60_000

/**
 * Plan & billing: one repeat job bills renewals a few days before a trial or period ends (an
 * order on the platform sales store with a pay link), marks unpaid plans due and pauses them
 * after the grace period (`runBillingSweep`). Off when PLATFORM_SALES_STORE_ID is unset.
 */
export function createBillingSweep(
  connection: IORedis,
  db: Db,
  opts: { salesStoreId: string | undefined; settingsSecret: string; storefrontUrl: string },
) {
  const queue = new Queue(BILLING_SWEEP_QUEUE, { connection })
  const worker = new Worker(
    BILLING_SWEEP_QUEUE,
    async () => {
      if (!opts.salesStoreId) return { skipped: 'no sales store' }
      const env = await resolveBillingEnv(db, opts)
      const r = await runBillingSweep(db, env)
      if (r.billed || r.due || r.paused) logger.info('plans swept', { area: 'billing', ...r })
      // Bought apps renew on the same clock.
      const apps = await runAppRenewals(db, env)
      if (apps.billed || apps.lapsed) logger.info('apps swept', { area: 'billing', ...apps })
      // Last month's per-order fees: does the work on the month's first run, a no-op after.
      const fees = await runUsageBilling(db, env)
      if (fees.billed || fees.carried) logger.info('fees billed', { area: 'billing', ...fees })
      return { ...r, apps, fees }
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
