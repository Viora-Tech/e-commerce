/** SOURCE OF TRUTH: automation step bookkeeping — WHAT: step-run rows, run endings and moves, retry classification and backoff (internal ×3, external up to 24 h), output truncation, and the failure circuit breaker / WHY: the interpreter's node handlers share one way to record a step and decide retry vs fail, so the run log and the retry contract read the same for every action (design §8.5). */
import {
  automationRun,
  automationStepRun,
  automationVersion,
  automationWorkflow,
  type StoreTx,
} from '@commerce/db'
import { and, eq, gte, sql } from 'drizzle-orm'
import { type ActionNode, type WorkflowDefinition, WorkflowDefinitionSchema } from '../definition'
import { AutomationActionError } from '../executor'
import { MAX_FAILURES_PER_HOUR, type RunStatus } from '../types'
import type { ResolvedAction } from './interpreter'
import { switchOffWithProblem } from './trigger'

export type RunRow = typeof automationRun.$inferSelect

/** Internal actions: a lock or deadlock is worth a quick retry. */
const INTERNAL_ATTEMPTS = 3
/** External actions (email, WhatsApp, HTTP, apps): backoff up to about a day (Flow: 24 h). */
const EXTERNAL_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 3600_000,
  6 * 3600_000,
  12 * 3600_000,
  24 * 3600_000,
]
const TRANSIENT_PG = new Set(['40001', '40P01', '55P03', '57014'])

/** The delay before attempt `attempt + 1`, or null when retries are used up. */
export function retryDelayMs(
  external: boolean,
  attempt: number,
  hint?: number | undefined,
): number | null {
  if (!external) return attempt < INTERNAL_ATTEMPTS ? 5_000 * 2 ** (attempt - 1) : null
  const base = EXTERNAL_DELAYS_MS[attempt - 1]
  if (base === undefined) return null
  return hint && hint > base ? Math.min(hint, 24 * 3600_000) : base
}

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } }
  const code = e?.code ?? e?.cause?.code
  return typeof code === 'string' ? code : undefined
}

/** Retryable: the executor said so, or the database had a transient conflict. */
function classify(err: unknown): { retryable: boolean; message: string; retryAfterMs?: number } {
  if (err instanceof AutomationActionError) {
    return {
      retryable: err.retryable,
      message: err.message,
      ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {}),
    }
  }
  const code = pgCode(err)
  const message = err instanceof Error ? err.message : String(err)
  return { retryable: code !== undefined && TRANSIENT_PG.has(code), message }
}

export const truncateOutput = (
  o: Record<string, unknown> | undefined,
): Record<string, unknown> | null => {
  if (!o) return null
  const json = JSON.stringify(o)
  return json.length <= 8192 ? o : { truncated: true, preview: json.slice(0, 8000) }
}

export type StepOutcome =
  | { kind: 'continue' }
  | { kind: 'park'; status: RunStatus; nextAt: Date | null }
  | { kind: 'done' }

/** Ends the run. */
export async function finish(
  tx: StoreTx,
  runId: string,
  status: RunStatus,
  now: Date,
  extra: {
    stopReason?: string | null
    error?: string | null
    convertedOrderId?: string | null
  } = {},
): Promise<StepOutcome> {
  await tx
    .update(automationRun)
    .set({ status, finishedAt: now, ...extra })
    .where(eq(automationRun.id, runId))
  return { kind: 'done' }
}

export async function moveTo(
  tx: StoreTx,
  runId: string,
  cursor: string | null,
): Promise<StepOutcome> {
  await tx
    .update(automationRun)
    .set({ cursor, status: 'running' })
    .where(eq(automationRun.id, runId))
  return { kind: 'continue' }
}

export type StepRow = typeof automationStepRun.$inferSelect

export async function stepRow(tx: StoreTx, runId: string, nodeId: string): Promise<StepRow | null> {
  const [row] = await tx
    .select()
    .from(automationStepRun)
    .where(
      and(
        eq(automationStepRun.runId, runId),
        eq(automationStepRun.nodeId, nodeId),
        eq(automationStepRun.iteration, 0),
      ),
    )
  return row ?? null
}

export type StepWrite = Partial<typeof automationStepRun.$inferInsert> & {
  status: StepRow['status']
}

/** Writes the node's step-run row (one per run, node and iteration). */
export async function writeStep(
  tx: StoreTx,
  run: RunRow,
  node: { id: string; kind: string },
  actionId: string | null,
  values: StepWrite,
): Promise<void> {
  await tx
    .insert(automationStepRun)
    .values({
      storeId: run.storeId,
      runId: run.id,
      nodeId: node.id,
      iteration: 0,
      kind: node.kind,
      actionId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [automationStepRun.runId, automationStepRun.nodeId, automationStepRun.iteration],
      set: values,
    })
}

/** On a failed step: retry later, carry on, or fail the run. */
export async function onActionError(
  tx: StoreTx,
  run: RunRow,
  node: ActionNode,
  resolved: ResolvedAction,
  attempt: number,
  err: unknown,
  now: Date,
): Promise<StepOutcome> {
  const c = classify(err)
  const delay = c.retryable
    ? retryDelayMs(resolved.descriptor.external, attempt, c.retryAfterMs)
    : null
  if (delay !== null) {
    const retryAt = new Date(now.getTime() + delay)
    await writeStep(tx, run, node, node.action, {
      status: 'failed',
      attempt,
      error: c.message.slice(0, 2000),
      retryAt,
      finishedAt: now,
    })
    await tx
      .update(automationRun)
      .set({ status: 'waiting', nextAt: retryAt })
      .where(eq(automationRun.id, run.id))
    return { kind: 'park', status: 'waiting', nextAt: retryAt }
  }
  await writeStep(tx, run, node, node.action, {
    status: 'failed',
    attempt,
    error: c.message.slice(0, 2000),
    retryAt: null,
    finishedAt: now,
  })
  if (node.onError === 'continue') return moveTo(tx, run.id, node.next)
  await failureBreaker(tx, run.workflowId, now)
  // The cursor stays on the failed node, so "Retry from failed step" re-runs it.
  return finish(tx, run.id, 'failed', now, { error: c.message.slice(0, 2000) })
}

/** More than 1,000 failed runs of one workflow in an hour switches it off (design §8.5). */
async function failureBreaker(tx: StoreTx, workflowId: string, now: Date) {
  const [{ n } = { n: 0 }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(automationRun)
    .where(
      and(
        eq(automationRun.workflowId, workflowId),
        eq(automationRun.status, 'failed'),
        gte(automationRun.finishedAt, new Date(now.getTime() - 3600_000)),
      ),
    )
  if (n + 1 > MAX_FAILURES_PER_HOUR) {
    await switchOffWithProblem(
      tx,
      workflowId,
      `Switched off: more than ${MAX_FAILURES_PER_HOUR} runs failed in an hour`,
    )
  }
}

/** A run's pinned version, parsed once per job. */
export async function loadDefinition(
  tx: StoreTx,
  versionId: string,
  cache: Map<string, WorkflowDefinition | null>,
): Promise<WorkflowDefinition | null> {
  if (cache.has(versionId)) return cache.get(versionId) ?? null
  const [v] = await tx
    .select({ definition: automationVersion.definition })
    .from(automationVersion)
    .where(eq(automationVersion.id, versionId))
  const parsed = v ? WorkflowDefinitionSchema.safeParse(v.definition) : null
  const def = parsed?.success ? parsed.data : null
  cache.set(versionId, def)
  return def
}

export async function workflowName(tx: StoreTx, id: string): Promise<string> {
  const [w] = await tx
    .select({ name: automationWorkflow.name })
    .from(automationWorkflow)
    .where(eq(automationWorkflow.id, id))
  return w?.name ?? ''
}

/** True for an Off Growth workflow: its runs wait, neither advancing nor ending. */
export async function isHeld(tx: StoreTx, workflowId: string): Promise<boolean> {
  const [w] = await tx
    .select({ status: automationWorkflow.status, origin: automationWorkflow.origin })
    .from(automationWorkflow)
    .where(eq(automationWorkflow.id, workflowId))
  return w?.status === 'off' && w.origin === 'growth'
}
