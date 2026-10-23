/** SOURCE OF TRUTH: automation queues — WHAT: the BullMQ queue names, job payloads and job ids of the Automations engine (trigger jobs per outbox row, step jobs per run generation, the tick) and the queue shape core enqueues on / WHY: the relay, the API and the worker must agree on names and ids so a re-enqueue is always a no-op. */

/** One job per outbox row an automation trigger may listen to (`trg-<rowId>`). */
export const AUTOMATION_TRIGGER_QUEUE = '{automations}-trigger'
/** One job per run generation (`run-<runId>-<nextAtMs>`): walks nodes until a wait or the end. */
export const AUTOMATION_STEP_QUEUE = '{automations}-step'
/** Repeat tick: due waits and retries, stale runs, approval expiry, schedules. */
export const AUTOMATION_TICK_QUEUE = '{automations}-tick'

export type AutomationTriggerJob = { storeId: string; outboxId: string }
export type AutomationStepJob = { storeId: string; runId: string }

type AddOpts = {
  jobId?: string
  delay?: number
  attempts?: number
  backoff?: { type: 'exponential' | 'fixed'; delay: number }
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
}

export type AutomationTriggerQueue = {
  add(name: string, data: AutomationTriggerJob, opts?: AddOpts): Promise<unknown>
}
export type AutomationStepQueue = {
  add(name: string, data: AutomationStepJob, opts?: AddOpts): Promise<unknown>
}

/** BullMQ allows ':' in a custom id only as exactly three parts; dashes keep it simple. */
export const triggerJobId = (outboxId: string): string => `trg-${outboxId}`

/**
 * A run's step job is keyed by its `next_at`: a re-enqueue of the same due run collapses into
 * the job already waiting, and the next generation (after a wait, a retry or an approval) gets
 * a new id. Step jobs are removed on completion so an id never blocks a later add.
 */
export const stepJobId = (runId: string, nextAt: Date): string => `run-${runId}-${nextAt.getTime()}`

/** Enqueue one run generation. Never throws: the tick re-enqueues anything due it missed. */
export async function enqueueRunStep(
  queue: AutomationStepQueue | null | undefined,
  run: { storeId: string; runId: string; nextAt: Date },
  log?: (message: string) => void,
): Promise<void> {
  if (!queue) return
  try {
    const delay = Math.max(0, run.nextAt.getTime() - Date.now())
    await queue.add(
      'step',
      { storeId: run.storeId, runId: run.runId },
      {
        jobId: stepJobId(run.runId, run.nextAt),
        removeOnComplete: true,
        removeOnFail: 1000,
        ...(delay > 0 ? { delay } : {}),
      },
    )
  } catch (err) {
    log?.(`[automations] enqueue ${run.runId} failed: ${err instanceof Error ? err.message : err}`)
  }
}
