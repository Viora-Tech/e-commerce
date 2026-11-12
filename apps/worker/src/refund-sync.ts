import { type RefundSyncResult, syncPendingRefunds } from '@commerce/core'
import { type Db, storesWithPendingGatewayRefunds } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { providersFor } from './payment-fees'

/** Daily: Decentro refunds usually settle within a few working days. */
export const REFUND_SYNC_EVERY_MS = 24 * 3_600_000

/** Refunds asked about per store per run. */
const PER_STORE_LIMIT = 100

/**
 * Every store with a pending refund on a gateway without refund webhooks (Decentro): ask the
 * gateway, record processed or failed (core payments/refund-sync.ts). One store failing is
 * logged and skipped; the next run tries again.
 */
export async function syncAllPendingRefunds(db: Db, settingsSecret: string) {
  const totals: RefundSyncResult = { checked: 0, processed: 0, failed: 0, errors: 0 }
  const storeIds = await storesWithPendingGatewayRefunds(db)
  for (const storeId of storeIds) {
    try {
      const providers = await providersFor(db, storeId, settingsSecret)
      const r = await syncPendingRefunds(db, storeId, providers, { limit: PER_STORE_LIMIT })
      totals.checked += r.checked
      totals.processed += r.processed
      totals.failed += r.failed
      totals.errors += r.errors
    } catch (err) {
      logger.warn('refund status sync failed', { storeId, error: err })
    }
  }
  return { stores: storeIds.length, ...totals }
}

export function createRefundSync(db: Db, opts: { settingsSecret: string }) {
  const run = async () => {
    const r = await syncAllPendingRefunds(db, opts.settingsSecret)
    if (r.checked) logger.info('pending refunds synced', { ...r })
    return r
  }
  return { run }
}
