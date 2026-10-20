/** SOURCE OF TRUTH: customer change events — WHAT: the `customer.created` / `customer.updated` outbox rows / WHY: apps mirroring customers (Chatwoot) hear about every change from one writer */
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
