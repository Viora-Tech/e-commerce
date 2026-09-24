import type { StoreTx } from '@commerce/db'
import { outboxEvent } from '@commerce/db'
import type { OutboxEventType, OutboxPayload } from './types'

/**
 * Write one outbox row. Callers must pass the same `tx` the state change
 * itself used (a `withStore` transaction), so a rollback of that change
 * rolls the event back with it. This is the whole point of the outbox: no
 * separate "did the enqueue also succeed" question.
 *
 * Pattern from Trigger.dev's task-run event log (Apache-2.0) and Temporal's
 * event-sourced workflow history (MIT): append to a durable log in the same
 * transaction as the state change, deliver as a separate concern.
 */
export async function insertOutboxEvent(
  tx: StoreTx,
  storeId: string,
  type: OutboxEventType,
  payload: OutboxPayload,
): Promise<void> {
  await tx.insert(outboxEvent).values({ storeId, type, payload })
}
