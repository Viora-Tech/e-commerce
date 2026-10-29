/** SOURCE OF TRUTH: Rollouts tick — WHAT: every minute, for each store with a rollout due (`stores_with_rollouts_due`, 0182), start the scheduled rollouts whose time came and end the events whose end passed (by their end action), each in its own transaction / WHY: a sale goes live and ends on time with nobody clicking; one rollout failing (its theme was deleted) never stops the others, and it says why on its page */
import { type Db, rollout, storesWithRolloutsDue, withStore } from '@commerce/db'
import { and, eq, lte, or } from 'drizzle-orm'
import { endRollout, failRollout, RolloutError, startRollout } from './service'

/** BullMQ queue of the tick (braces keep its keys on one slot). */
export const ROLLOUTS_QUEUE = '{rollouts}-tick'
/** How often due rollouts are looked for: a rollout starts within a minute of its time. */
export const ROLLOUTS_EVERY_MS = 60_000

export type RolloutsTickOutcome = { stores: number; started: number; ended: number; failed: number }

export async function runRolloutsTick(
  db: Db,
  at = new Date(),
  opts: { log?: (message: string) => void } = {},
): Promise<RolloutsTickOutcome> {
  const out: RolloutsTickOutcome = { stores: 0, started: 0, ended: 0, failed: 0 }
  for (const storeId of await storesWithRolloutsDue(db, at)) {
    out.stores += 1
    const due = await withStore(db, storeId, (tx) =>
      tx
        .select({ id: rollout.id, status: rollout.status, endAction: rollout.endAction })
        .from(rollout)
        .where(
          or(
            and(eq(rollout.status, 'scheduled'), lte(rollout.startsAt, at)),
            and(eq(rollout.status, 'active'), eq(rollout.kind, 'event'), lte(rollout.endsAt, at)),
          ),
        ),
    )
    for (const r of due) {
      try {
        await withStore(db, storeId, (tx) =>
          r.status === 'scheduled'
            ? startRollout({ storeId, tx }, r.id, at)
            : endRollout({ storeId, tx }, r.id, r.endAction, at),
        )
        if (r.status === 'scheduled') out.started += 1
        else out.ended += 1
      } catch (e) {
        out.failed += 1
        const reason = e instanceof Error ? e.message : String(e)
        opts.log?.(`rollout ${r.id} in store ${storeId}: ${reason}`)
        // A start that cannot apply turns the rollout back into a draft with the reason, so
        // the next tick does not try again every minute.
        if (r.status === 'scheduled' && e instanceof RolloutError) {
          await withStore(db, storeId, (tx) => failRollout({ storeId, tx }, r.id, reason))
        }
      }
    }
  }
  return out
}
