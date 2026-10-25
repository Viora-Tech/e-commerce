/** SOURCE OF TRUTH: the store's low-stock threshold — WHAT: reads `store.low_stock_threshold`, falling back to LOW_STOCK_THRESHOLD / WHY: every place that decides "low" asks here, so one setting moves them all */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { LOW_STOCK_THRESHOLD } from './stock-state'

/**
 * The store's low-stock threshold (Settings, `store.low_stock_threshold`), or
 * `LOW_STOCK_THRESHOLD` when it is not set. Every place that decides "low" reads it from here.
 * The transaction is store-scoped, so `storeId` only narrows when the caller has it.
 */
export async function storeLowStockThreshold(tx: StoreTx, storeId?: string): Promise<number> {
  const [row] = await tx
    .select({ n: store.lowStockThreshold })
    .from(store)
    .where(storeId ? eq(store.id, storeId) : undefined)
    .limit(1)
  return row?.n ?? LOW_STOCK_THRESHOLD
}
