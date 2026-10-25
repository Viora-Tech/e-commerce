/** SOURCE OF TRUTH: customer change events — WHAT: the `customer.created` / `customer.updated` outbox rows, and `customer.tags_changed` with the diff (the Automations trigger) / WHY: apps mirroring customers (Chatwoot) hear about every change from one writer */
import type { StoreTx } from '@commerce/db'
import { insertOutboxEvent } from '../outbox/write'

/**
 * Note that a customer was created or changed, in the same transaction as the change, so
 * installed apps that mirror customers elsewhere (Chatwoot contacts) hear about it through the
 * outbox (`customer.created` / `customer.updated` app hooks). Consumers read the customer when
 * they run and upsert, so two quick changes are safe in any order. Bulk imports do not call it.
 */
export async function recordCustomerChange(
  tx: StoreTx,
  storeId: string,
  customerId: string,
  change: 'created' | 'updated',
): Promise<void> {
  await insertOutboxEvent(tx, storeId, `customer.${change}`, { customerId })
}

/**
 * `customer.tags_changed` with what was added and removed (compared without regard to case),
 * written only when the tags really changed. Every staff, shopper and newsletter tag write
 * calls it; automations write their own with the run's cause.
 */
export async function noteCustomerTagsChanged(
  tx: StoreTx,
  storeId: string,
  customerId: string,
  before: readonly string[],
  after: readonly string[],
): Promise<void> {
  const had = new Set(before.map((t) => t.toLowerCase()))
  const has = new Set(after.map((t) => t.toLowerCase()))
  const tagsAdded = after.filter((t) => !had.has(t.toLowerCase()))
  const tagsRemoved = before.filter((t) => !has.has(t.toLowerCase()))
  if (tagsAdded.length === 0 && tagsRemoved.length === 0) return
  await insertOutboxEvent(tx, storeId, 'customer.tags_changed', {
    customerId,
    tagsAdded,
    tagsRemoved,
  })
}
