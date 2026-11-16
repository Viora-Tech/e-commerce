/** SOURCE OF TRUTH: browser push queue — WHAT: the BullMQ queue the worker sends staff push notifications from, its job shape (an outbox row, or a "Send a test" for one member) and which outbox events become a push / WHY: the outbox relay and the admin's test button hand the worker the same small job, and a row's own id as the job id keeps a re-dispatched row from pushing twice */
import type { OutboxEventType } from '../outbox/types'

/** BullMQ queue name. */
export const PUSH_QUEUE = '{push}-send'

export type PushJob =
  | { storeId: string; outboxId: string }
  /** Account → Notifications "Send a test": one member's own devices. */
  | { storeId: string; testUserId: string }

export type PushQueue = {
  add(
    name: string,
    data: PushJob,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
      removeOnComplete?: boolean | number
      removeOnFail?: boolean | number
    },
  ): Promise<unknown>
}

/** The outbox events staff can get a push for; each maps to one alert in `push/messages.ts`. */
export const PUSH_OUTBOX_TYPES: ReadonlySet<OutboxEventType> = new Set<OutboxEventType>([
  'order.placed',
  'inbox.message_received',
  'approval.requested',
  'inventory.out',
  'payments.gateway_keys_refused',
  'channel.sync_failed',
  'meta.access_removed',
  'pixel.connection_failed',
])

/** A push service that is slow or down gets a few tries; a stale push is worth little after that. */
const PUSH_ATTEMPTS = 3
const PUSH_BACKOFF_MS = 10_000

/** Queues the push for one outbox row. Keyed by the row: a second dispatch is a no-op. */
export async function enqueuePushForRow(
  queue: PushQueue,
  row: { id: string; storeId: string },
): Promise<void> {
  await queue.add(
    'row',
    { storeId: row.storeId, outboxId: row.id },
    {
      jobId: `push-${row.id}`,
      attempts: PUSH_ATTEMPTS,
      backoff: { type: 'exponential', delay: PUSH_BACKOFF_MS },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  )
}

/** Queues "Send a test" for one member. */
export async function enqueuePushTest(
  queue: PushQueue,
  job: { storeId: string; userId: string },
): Promise<void> {
  await queue.add(
    'test',
    { storeId: job.storeId, testUserId: job.userId },
    { attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
  )
}
