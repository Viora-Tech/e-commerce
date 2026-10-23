/** SOURCE OF TRUTH: automation record events — WHAT: the outbox rows the Automations triggers listen to that existing write paths emit: product created/updated, customer tags changed, stock low/out crossings / WHY: every write site calls these inside its own transaction, so a trigger fires exactly when the change commits and never for a change that rolled back (design §8.4 starred triggers). */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { insertOutboxEvent } from '../outbox/write'

async function storeOf(tx: StoreTx, storeId: string | undefined): Promise<string | null> {
  if (storeId) return storeId
  const [row] = await tx.execute<{ id: string | null }>(
    sql`select nullif(current_setting('app.store_id', true), '') as id`,
  )
  return row?.id ?? null
}

/** A product was created or edited by a person (single-product paths; bulk edits do not fire). */
export async function noteProductEvent(
  tx: StoreTx,
  storeId: string | undefined,
  productId: string,
  kind: 'created' | 'updated',
): Promise<void> {
  const store = await storeOf(tx, storeId)
  if (!store) return
  await insertOutboxEvent(tx, store, kind === 'created' ? 'product.created' : 'product.updated', {
    productId,
  })
}

/** A customer's tags changed; nothing is written when the set did not change. */
export async function noteCustomerTagsChanged(
  tx: StoreTx,
  storeId: string | undefined,
  customerId: string,
  before: readonly string[],
  after: readonly string[],
): Promise<void> {
  const was = new Set(before.map((t) => t.toLowerCase()))
  const now = new Set(after.map((t) => t.toLowerCase()))
  const tagsAdded = after.filter((t) => !was.has(t.toLowerCase()))
  const tagsRemoved = before.filter((t) => !now.has(t.toLowerCase()))
  if (!tagsAdded.length && !tagsRemoved.length) return
  const store = await storeOf(tx, storeId)
  if (!store) return
  await insertOutboxEvent(tx, store, 'customer.tags_changed', {
    customerId,
    tagsAdded,
    tagsRemoved,
  })
}

/**
 * A stock change crossed the low-stock line or hit zero (a crossing, not every change, so a
 * busy variant does not fire on every sale). `before` / `after` are available units.
 */
export async function noteStockCrossing(
  tx: StoreTx,
  input: {
    storeId: string
    productId: string
    variantId: string
    locationId: string
    before: number
    after: number
    threshold: number
  },
): Promise<void> {
  const { before, after, threshold } = input
  const payload = {
    productId: input.productId,
    variantId: input.variantId,
    locationId: input.locationId,
  }
  if (before > 0 && after <= 0) {
    await insertOutboxEvent(tx, input.storeId, 'inventory.out', payload)
  } else if (before > threshold && after <= threshold && after > 0) {
    await insertOutboxEvent(tx, input.storeId, 'inventory.low', payload)
  }
}
