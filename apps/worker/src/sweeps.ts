import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, SWEEPS_QUEUE, Worker } from '@commerce/queue'

/** When a sweep runs: every N ms, or a cron pattern (India time unless `tz` says otherwise). */
export type SweepSchedule = { every: number } | { pattern: string; tz?: string }

/**
 * One scheduled job: what it runs and when. `name` is its job name and scheduler id on the shared
 * queue, and the label its wide events and Sentry reports carry (the old queue's label, so log
 * searches still find it). `legacy` is the queue and scheduler it had before the shared queue.
 * `enabled: false` removes its schedule (no provider, no token) instead of adding it.
 */
export type Sweep = {
  name: string
  schedule: SweepSchedule
  run: () => Promise<unknown>
  legacy: { queue: string; scheduler: string }
  enabled?: boolean | undefined
}

/**
 * Sweeps that may run at the same time. Each one used to have a worker of its own; most finish
 * in milliseconds, and a few call couriers, gateways or GitHub, so a handful of slots keeps a
 * slow one from holding up the minute ticks (unpaid orders, pre-order balances).
 */
export const SWEEP_CONCURRENCY = 6

/**
 * The shared queue and its one worker. A sweep never overlaps itself: if its next run comes due
 * while the last is still going, that run is skipped (`{ skipped: 1 }`) and the one after it
 * runs on time. With a worker per sweep the late run waited instead; for these jobs, which all
 * pick up whatever is due, skipping does the same work with less load.
 */
export function createSweepWorker(connection: IORedis, sweeps: readonly Sweep[]) {
  const byName = new Map(sweeps.map((s) => [s.name, s]))
  const running = new Set<string>()
  const queue = new Queue(SWEEPS_QUEUE, { connection })
  const worker = new Worker(SWEEPS_QUEUE, async (job) => runSweep(byName, running, job.name), {
    connection,
    concurrency: SWEEP_CONCURRENCY,
    ...KEEP_FINISHED,
  })
  return { queue, worker }
}

/** One sweep job: the sweep it names, unless that sweep is still running. Exported for tests. */
export async function runSweep(
  byName: ReadonlyMap<string, Pick<Sweep, 'run'>>,
  running: Set<string>,
  name: string,
): Promise<unknown> {
  const sweep = byName.get(name)
  if (!sweep) {
    // A schedule this build no longer has (a rollback, a renamed sweep): nothing to run.
    logger.warn('unknown sweep', { area: 'sweeps', name })
    return { unknown: 1 }
  }
  if (running.has(name)) return { skipped: 1 }
  running.add(name)
  try {
    return await sweep.run()
  } finally {
    running.delete(name)
  }
}

type SchedulerQueue = Pick<Queue, 'upsertJobScheduler' | 'removeJobScheduler' | 'add'>
type LegacyQueue = Pick<Queue, 'getJobScheduler' | 'removeJobScheduler' | 'obliterate' | 'close'>

/**
 * Puts every sweep on the shared queue and retires its old queue. Safe to run on every boot.
 *
 * First boot after the move, per sweep:
 * 1. The old scheduler's next run is read. An `every` sweep starts at that time on the shared
 *    queue (`startDate`), so a deploy neither runs it early nor skips a turn; a cron sweep keeps
 *    its pattern, and if its old run was already due and not yet taken, it runs once now.
 * 2. The old scheduler is removed, then the old queue is deleted with its finished-job history
 *    (`obliterate`). A queue with a job still active (only when an old container is still
 *    finishing it) is retried once two minutes later, then forcibly.
 * Later boots: the shared schedulers already exist and keep their times; there is nothing left
 * to retire, so step 2 finds empty queues.
 */
export async function scheduleSweeps(
  queue: SchedulerQueue,
  sweeps: readonly Sweep[],
  legacyQueue: (name: string) => LegacyQueue,
  opts: { now?: () => number; retryLaterMs?: number } = {},
): Promise<void> {
  const now = opts.now ?? Date.now
  for (const sweep of sweeps) {
    const old = legacyQueue(sweep.legacy.queue)
    try {
      const next = (await old.getJobScheduler(sweep.legacy.scheduler))?.next
      if (sweep.enabled === false) {
        await queue.removeJobScheduler(sweep.name)
      } else if ('every' in sweep.schedule) {
        await queue.upsertJobScheduler(
          sweep.name,
          { every: sweep.schedule.every, ...(next ? { startDate: next } : {}) },
          { name: sweep.name },
        )
      } else {
        await queue.upsertJobScheduler(sweep.name, sweep.schedule, { name: sweep.name })
        if (next && next <= now()) await queue.add(sweep.name, {})
      }
      await old.removeJobScheduler(sweep.legacy.scheduler)
      await retireQueue(old, sweep.legacy.queue, opts.retryLaterMs ?? 2 * 60_000)
    } catch (err) {
      logger.error('could not schedule sweep', { area: 'sweeps', name: sweep.name, error: err })
    }
  }
}

async function retireQueue(old: LegacyQueue, name: string, retryLaterMs: number) {
  try {
    await old.obliterate()
    await old.close()
  } catch (err) {
    // Active jobs: an old container may still be finishing one. Its lock lapses in 30s.
    logger.info('old sweep queue busy, retrying later', { area: 'sweeps', queue: name, error: err })
    setTimeout(() => {
      old
        .obliterate({ force: true })
        .catch((e: unknown) =>
          logger.warn('could not delete old sweep queue', {
            area: 'sweeps',
            queue: name,
            error: e,
          }),
        )
        .finally(() => old.close().catch(() => undefined))
    }, retryLaterMs).unref()
  }
}
