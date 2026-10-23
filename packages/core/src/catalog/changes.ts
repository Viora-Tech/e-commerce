/** SOURCE OF TRUTH: catalogue change events — WHAT: `noteProductsChanged` writes the `catalog.products_changed` outbox row every product write path calls, and `noteProductEvent` the per-product `product.created` / `product.updated` rows the Automations triggers listen to / WHY: apps that keep a copy of the catalogue (the Meilisearch app's search index) catch up after the transaction commits, without core importing them */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { insertOutboxEvent } from '../outbox/write'

/** Ids per outbox row, so a big bulk edit stays a handful of small jobs. */
const IDS_PER_EVENT = 500

/**
 * Record that products changed (created, edited, archived or deleted), in the caller's
 * transaction, so apps that keep a copy of the catalogue (the Meilisearch app's search index)
 * catch up once it commits. `storeId` defaults to the transaction's own store (`withStore`).
 */
export async function noteProductsChanged(
  tx: StoreTx,
  productIds: readonly string[],
  storeId?: string,
): Promise<void> {
  const ids = [...new Set(productIds)]
  if (!ids.length) return
  const store = storeId ?? (await currentStore(tx))
  if (!store) return
  for (let i = 0; i < ids.length; i += IDS_PER_EVENT) {
    await insertOutboxEvent(tx, store, 'catalog.products_changed', {
      productIds: ids.slice(i, i + IDS_PER_EVENT),
    })
  }
}

/** The store a `withStore` transaction is scoped to ('' outside one). */
export async function txStoreId(tx: StoreTx): Promise<string> {
  return (await currentStore(tx)) ?? ''
}

async function currentStore(tx: StoreTx): Promise<string | null> {
  const [row] = await tx.execute<{ id: string | null }>(
    sql`select nullif(current_setting('app.store_id', true), '') as id`,
  )
  return row?.id ?? null
}

/**
 * `product.created` / `product.updated` for the Automations triggers, one row per product in
 * the caller's transaction. Imports (CSV, Shopify) do not call it: like imported orders,
 * imported products never start automations, so a 5,000-row import adds no automation work.
 */
export async function noteProductEvent(
  tx: StoreTx,
  storeId: string,
  type: 'product.created' | 'product.updated',
  productIds: readonly string[],
): Promise<void> {
  if (!storeId) return
  for (const productId of new Set(productIds)) {
    await insertOutboxEvent(tx, storeId, type, { productId })
  }
}
