/** SOURCE OF TRUTH: automation job handlers — WHAT: what the worker's three automation queues do (trigger job → runs, step job → interpreter, tick → due work per store), each returning the runs to enqueue / WHY: the worker stays a thin BullMQ shell and every database touch stays in core (the service-layer rule). */
import { type Db, storesWithAutomationWork, withStore } from '@commerce/db'
import { type AdvanceResult, advanceRun, type EngineDeps } from './interpreter'
import { type AutomationStepQueue, enqueueRunStep } from './jobs'
import { automationTick, type TickSweep } from './tick'
import { startRunsForOutboxRow } from './trigger'

type Log = ((message: string) => void) | undefined

/** `{automations}-trigger`: starts the row's runs, then queues their first step. */
export async function runTriggerJob(
  db: Db,
  job: { storeId: string; outboxId: string },
  steps: AutomationStepQueue,
  log?: Log,
) {
  const outcome = await withStore(db, job.storeId, (tx) =>
    startRunsForOutboxRow(tx, job.storeId, job.outboxId),
  )
  for (const r of outcome.started) {
    await enqueueRunStep(steps, { storeId: job.storeId, runId: r.runId, nextAt: r.nextAt }, log)
  }
  return { started: outcome.started.length, skipped: outcome.skipped.length }
}

/** `{automations}-step`: advances one run; a wait or retry queues its next generation delayed. */
export async function runStepJob(
  db: Db,
  job: { storeId: string; runId: string },
  deps: EngineDeps,
  steps: AutomationStepQueue,
): Promise<AdvanceResult> {
  const result = await advanceRun(db, job.storeId, job.runId, deps)
  const parked = result.parked
  if (parked?.nextAt && (parked.status === 'waiting' || parked.status === 'running')) {
    await enqueueRunStep(
      steps,
      { storeId: job.storeId, runId: job.runId, nextAt: parked.nextAt },
      deps.log,
    )
  }
  return result
}

/** `{automations}-tick`: every store with due work; one store failing never stops the rest. */
export async function runTickJob(
  db: Db,
  steps: AutomationStepQueue,
  log?: Log,
  sweeps: readonly TickSweep[] = [],
) {
  const storeIds = await storesWithAutomationWork(db)
  let queued = 0
  let expired = 0
  for (const storeId of storeIds) {
    try {
      const r = await withStore(db, storeId, (tx) =>
        automationTick(tx, storeId, new Date(), { sweeps }),
      )
      expired += r.expired
      for (const run of [...r.due, ...r.scheduled]) {
        await enqueueRunStep(steps, { storeId, runId: run.runId, nextAt: run.nextAt }, log)
        queued += 1
      }
    } catch (err) {
      log?.(`[automations] tick ${storeId} failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  return { stores: storeIds.length, queued, expired }
}
