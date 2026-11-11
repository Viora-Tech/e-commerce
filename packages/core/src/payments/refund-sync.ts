/**
 * SOURCE OF TRUTH KEYWORDS: syncPendingRefunds, refund status sync, Decentro refunds
 * WHAT:  Ask the gateway about refunds still `pending`, for gateways whose refund updates do
 *        not come by webhook (`fetchRefundStatus`, Decentro): processed or failed is recorded
 *        through `settleRefunds`, so a failed refund no longer counts as money returned.
 * WHY:   Decentro documents no refund callback; without asking, a refund it later failed was
 *        never noticed and the order kept saying the money went back.
 * WHERE: The worker's daily refund sync (apps/worker/src/refund-sync.ts).
 */
import { type Db, payment, refund, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { PaymentProvider } from '@commerce/payments'
import { and, asc, eq, gt, inArray, isNotNull, lt } from 'drizzle-orm'
import { settleRefunds } from './refund-settle'

const DAY_MS = 86_400_000

export type RefundSyncOptions = {
  now?: Date | undefined
  /** How far back to ask; older refunds are left as they are. Default 60 days. */
  days?: number | undefined
  /** A refund this new is left for the next run (the gateway may still be working). Default 1 hour. */
  minAgeMs?: number | undefined
  /** Refunds asked about per run. Default 100. */
  limit?: number | undefined
}

export type RefundSyncResult = {
  checked: number
  processed: number
  failed: number
  errors: number
}

/**
 * One store: its pending gateway refunds, oldest first, each asked outside any transaction
 * and recorded in a short one of its own. Idempotent: a settled refund is never asked again.
 */
export async function syncPendingRefunds(
  db: Db,
  storeId: string,
  providers: readonly PaymentProvider[],
  opts: RefundSyncOptions = {},
): Promise<RefundSyncResult> {
  const result: RefundSyncResult = { checked: 0, processed: 0, failed: 0, errors: 0 }
  const byId = new Map(providers.filter((p) => p.fetchRefundStatus).map((p) => [p.id, p]))
  if (byId.size === 0) return result
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - (opts.days ?? 60) * DAY_MS)
  const before = new Date(now.getTime() - (opts.minAgeMs ?? 3_600_000))

  const rows = await withStore(db, storeId, (tx) =>
    tx
      .select({
        id: refund.id,
        providerRefundId: refund.providerRefundId,
        provider: payment.provider,
        providerRef: payment.providerRef,
      })
      .from(refund)
      .innerJoin(payment, eq(payment.id, refund.paymentId))
      .where(
        and(
          eq(refund.status, 'pending'),
          isNotNull(refund.providerRefundId),
          inArray(payment.provider, [...byId.keys()]),
          gt(refund.createdAt, since),
          lt(refund.createdAt, before),
        ),
      )
      .orderBy(asc(refund.createdAt))
      .limit(opts.limit ?? 100),
  )

  for (const row of rows) {
    const provider = byId.get(row.provider)
    if (!provider?.fetchRefundStatus || !row.providerRefundId) continue
    result.checked += 1
    let state: 'pending' | 'processed' | 'failed'
    try {
      state = await provider.fetchRefundStatus({
        providerRefundId: row.providerRefundId,
        providerRef: row.providerRef,
      })
    } catch (err) {
      result.errors += 1
      logger.warn('refund status lookup failed', {
        storeId,
        refundId: row.id,
        provider: row.provider,
        error: err,
      })
      continue
    }
    if (state === 'pending') continue
    const changed = await withStore(db, storeId, (tx) =>
      settleRefunds({ storeId, tx }, eq(refund.id, row.id), state),
    )
    if (changed) result[state] += 1
  }
  return result
}
