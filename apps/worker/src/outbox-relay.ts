import {
  type AppEventQueue,
  type NotificationQueue,
  type OutboxRelayDeps,
  relayStoreOutbox,
} from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import { type Db, storesWithUndispatchedOutboxEvents } from '@commerce/db'
import { type IORedis, OUTBOX_RELAY_QUEUE, Queue, Worker } from '@commerce/queue'

/** How often the sweep looks for undispatched rows across every store. */
export const RELAY_EVERY_MS = 5_000

export type OutboxRelayJob = { storeId?: string }

/**
 * One repeat job walks every store with undispatched outbox rows and fans
 * each row out to its notification and app-hook consumers (see
 * `relayStoreOutbox`). One store failing (a bad row, a transient DB error) is
 * logged and skipped; the next tick tries again. Also accepts a one-off
 * `{ storeId }` job so an interactive admin action can nudge its own store's
 * rows out sooner than the next sweep, without waiting on every other store.
 *
 * Pattern from Trigger.dev's event log and Temporal's workflow history
 * (credited in `outbox/write.ts`): a durable poll-and-fan-out relay, not a
 * message broker.
 */
export function createOutboxRelay(
  connection: IORedis,
  db: Db,
  opts: { notifications: NotificationQueue; appEvents?: AppEventQueue | undefined },
) {
  const deps: OutboxRelayDeps = {
    db,
    plugins: getRegistries(),
    notifications: opts.notifications,
    appEvents: opts.appEvents,
    log: (message) => console.log(`[outbox] ${message}`),
  }
  const queue = new Queue<OutboxRelayJob>(OUTBOX_RELAY_QUEUE, { connection })
  const worker = new Worker<OutboxRelayJob>(
    OUTBOX_RELAY_QUEUE,
    async (job) => {
      const storeIds = job.data.storeId
        ? [job.data.storeId]
        : await storesWithUndispatchedOutboxEvents(db)
      let dispatched = 0
      let failed = 0
      for (const storeId of storeIds) {
        try {
          const r = await relayStoreOutbox(deps, storeId)
          dispatched += r.dispatched
          failed += r.failed
        } catch (err) {
          console.warn(`[outbox] store ${storeId} failed:`, err)
        }
      }
      if (dispatched || failed) console.log(`[outbox] dispatched=${dispatched} failed=${failed}`)
      return { stores: storeIds.length, dispatched, failed }
    },
    { connection },
  )
  return { queue, worker }
}

/**
 * Best-effort immediate nudge for one store, meant to be called right after
 * a commit that wrote outbox rows. The periodic sweep above is what
 * guarantees delivery; this only shaves the wait from a few seconds down to
 * near-immediate for interactive admin actions. Cheap: one `add` call with a
 * per-second-bucket job id, so a burst of nudges for the same store collapses
 * into at most one extra relay run.
 */
export async function nudgeOutboxRelay(
  queue: Queue<OutboxRelayJob>,
  storeId: string,
): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000)
  await queue.add(
    'nudge',
    { storeId },
    { jobId: `nudge:${storeId}:${bucket}`, removeOnComplete: true, removeOnFail: true },
  )
}
