/** SOURCE OF TRUTH: Automations housekeeping — WHAT: the daily retention prune (step detail after 90 days, finished runs after 13 months; monthly usage rows are never pruned) and pausing the workflows that use an app's triggers or actions when that app is uninstalled / WHY: run logs grow with every order, and a workflow whose app is gone must stop with a note instead of failing every run (design §8.3, §8.9). */
import {
  automationRun,
  automationStepRun,
  automationVersion,
  automationWorkflow,
  type Db,
  type StoreTx,
  storesWithOldAutomationRuns,
  withStore,
} from '@commerce/db'
import { and, eq, inArray, isNull, lt, notInArray, or } from 'drizzle-orm'
import { pluginIdOfPiece } from '../catalogue'
import { OPEN_RUN_STATUSES, RUN_RETENTION_MONTHS } from '../types'

/** BullMQ queue of the daily prune (braces keep its keys on one slot). */
export const AUTOMATION_PRUNE_QUEUE = '{automations}-prune'
export const AUTOMATION_PRUNE_EVERY_MS = 24 * 60 * 60_000

/** Step detail (inputs, outputs, condition traces) is kept this long. */
export const STEP_DETAIL_RETENTION_DAYS = 90

const DAY_MS = 86_400_000

/**
 * One store's prune. Step rows older than 90 days go (their run's summary row stays, so the
 * Runs list and "Automations on this record" keep working); runs that finished more than 13
 * months ago go with their record links. Open runs (waiting up to 60 days, awaiting approval)
 * and their steps are never touched; `automation_usage` is kept for plan history.
 */
export async function pruneAutomationRuns(
  tx: StoreTx,
  now = new Date(),
): Promise<{ steps: number; runs: number }> {
  const stepCutoff = new Date(now.getTime() - STEP_DETAIL_RETENTION_DAYS * DAY_MS)
  const runCutoff = new Date(now)
  runCutoff.setMonth(runCutoff.getMonth() - RUN_RETENTION_MONTHS)
  const open = tx
    .select({ id: automationRun.id })
    .from(automationRun)
    .where(inArray(automationRun.status, [...OPEN_RUN_STATUSES]))
  const steps = await tx
    .delete(automationStepRun)
    .where(
      and(lt(automationStepRun.startedAt, stepCutoff), notInArray(automationStepRun.runId, open)),
    )
    .returning({ id: automationStepRun.id })
  const runs = await tx
    .delete(automationRun)
    .where(
      and(
        notInArray(automationRun.status, [...OPEN_RUN_STATUSES]),
        or(
          lt(automationRun.finishedAt, runCutoff),
          // A closed run without a finish time is dated by its start.
          and(isNull(automationRun.finishedAt), lt(automationRun.startedAt, runCutoff)),
        ),
      ),
    )
    .returning({ id: automationRun.id })
  return { steps: steps.length, runs: runs.length }
}

/**
 * Whether a stored definition uses a piece of this app (its trigger or any action). Read
 * loosely, not through the schema: an unfinished draft still counts.
 */
function usesApp(raw: unknown, pluginId: string): boolean {
  if (!raw || typeof raw !== 'object') return false
  const def = raw as { trigger?: { type?: unknown }; nodes?: Record<string, { action?: unknown }> }
  const ids = [def.trigger?.type, ...Object.values(def.nodes ?? {}).map((n) => n?.action)].filter(
    (id): id is string => typeof id === 'string',
  )
  return ids.some((id) => pluginIdOfPiece(id) === pluginId)
}

/**
 * The app was uninstalled: every workflow whose live version (or draft) uses one of its
 * triggers or actions is switched off with a note saying why. Returns the workflows paused.
 * Reinstalling the app does not switch them back on: the merchant checks and turns them on.
 */
export async function pauseWorkflowsForRemovedApp(
  tx: StoreTx,
  pluginId: string,
  appName: string,
): Promise<string[]> {
  const rows = await tx
    .select({
      id: automationWorkflow.id,
      status: automationWorkflow.status,
      draft: automationWorkflow.draftDefinition,
      live: automationVersion.definition,
    })
    .from(automationWorkflow)
    .leftJoin(automationVersion, eq(automationVersion.id, automationWorkflow.publishedVersionId))
  const hit = rows.filter((r) => usesApp(r.live, pluginId) || usesApp(r.draft, pluginId))
  if (hit.length === 0) return []
  await tx
    .update(automationWorkflow)
    .set({
      status: 'off',
      problem: `Paused: the ${appName} app was removed. Reinstall it, or remove its steps, then switch this workflow back on.`,
      updatedAt: new Date(),
    })
    .where(
      inArray(
        automationWorkflow.id,
        hit.map((r) => r.id),
      ),
    )
  return hit.map((r) => r.id)
}

/** `{automations}-prune`, daily: every store with rows past retention; one store failing never stops the rest. */
export async function runAutomationPruneJob(
  db: Db,
  now = new Date(),
  log?: (message: string) => void,
): Promise<{ stores: number; steps: number; runs: number }> {
  const out = { stores: 0, steps: 0, runs: 0 }
  for (const storeId of await storesWithOldAutomationRuns(db, now)) {
    try {
      const r = await withStore(db, storeId, (tx) => pruneAutomationRuns(tx, now))
      out.stores += 1
      out.steps += r.steps
      out.runs += r.runs
    } catch (err) {
      log?.(`[automations] prune ${storeId} failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  return out
}
