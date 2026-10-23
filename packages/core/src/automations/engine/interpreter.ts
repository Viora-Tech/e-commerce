/** SOURCE OF TRUTH: the automation interpreter — WHAT: advances one run node by node (condition → branch, action → executor with approval, retries and onError, wait → park), each node in its own store transaction with its step-run row, until the run waits, asks, ends or fails / WHY: the DB row is the run's only state, so a crash, a Redis loss or a duplicate job never loses or repeats an internal action (design §8.5). */
import {
  automationRun,
  automationRunRecord,
  automationStepRun,
  automationVersion,
  automationWorkflow,
  type Db,
  type StoreTx,
  withStore,
} from '@commerce/db'
import { and, eq, gte, sql } from 'drizzle-orm'
import { type ActionDescriptor, builtinAction, nodeNeedsApproval } from '../catalogue'
import {
  type ActionNode,
  type ConditionNode,
  type WaitNode,
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
} from '../definition'
import {
  type ActionContext,
  type ActionExecutor,
  AutomationActionError,
  type ConditionEvaluator,
  type RunSubject,
  type SubjectData,
  type SubjectLoader,
} from '../executor'
import { renderMergeTags } from '../merge-tags'
import { actionExecutor } from '../registry'
import {
  APPROVAL_EXPIRY_HOURS,
  type AutomationCause,
  MAX_FAILURES_PER_HOUR,
  type RunReason,
  type RunStatus,
} from '../types'
import { switchOffWithProblem } from './trigger'

type RunRow = typeof automationRun.$inferSelect

/** An action as the interpreter needs it: its descriptor and its server half. */
export type ResolvedAction = { descriptor: ActionDescriptor; executor: ActionExecutor }

/** A marketing exit (design §10): converted or stopped before the next node runs. */
export type ExitDecision = {
  status: 'converted' | 'stopped'
  reason?: RunReason | undefined
  convertedOrderId?: string | null | undefined
}

export type EngineDeps = {
  evaluate: ConditionEvaluator
  loadSubject: SubjectLoader
  /** Built-ins by default; the worker adds installed plugins' actions. */
  resolveAction?:
    | ((tx: StoreTx, storeId: string, id: string) => Promise<ResolvedAction | null>)
    | undefined
  /** Runs before every node of a workflow with `exitOnOrder` (Growth parity lives here). */
  exitCheck?:
    | ((tx: StoreTx, run: RunRow, def: WorkflowDefinition) => Promise<ExitDecision | null>)
    | undefined
  log?: ((message: string) => void) | undefined
  now?: (() => Date) | undefined
}

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
/** Nodes one step job walks before handing back (a workflow has at most 50). */
const MAX_NODES_PER_JOB = 60
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

const truncateOutput = (o: Record<string, unknown> | undefined): Record<string, unknown> | null => {
  if (!o) return null
  const json = JSON.stringify(o)
  return json.length <= 8192 ? o : { truncated: true, preview: json.slice(0, 8000) }
}

async function defaultResolve(
  _tx: StoreTx,
  _storeId: string,
  id: string,
): Promise<ResolvedAction | null> {
  const descriptor = builtinAction(id)
  const executor = actionExecutor(id)
  return descriptor && executor ? { descriptor, executor } : null
}

type StepOutcome =
  | { kind: 'continue' }
  | { kind: 'park'; status: RunStatus; nextAt: Date | null }
  | { kind: 'done' }

/** Ends the run. */
async function finish(
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

async function moveTo(tx: StoreTx, runId: string, cursor: string | null): Promise<StepOutcome> {
  await tx
    .update(automationRun)
    .set({ cursor, status: 'running' })
    .where(eq(automationRun.id, runId))
  return { kind: 'continue' }
}

type StepRow = typeof automationStepRun.$inferSelect

async function stepRow(tx: StoreTx, runId: string, nodeId: string): Promise<StepRow | null> {
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

type StepWrite = Partial<typeof automationStepRun.$inferInsert> & {
  status: StepRow['status']
}

/** Writes the node's step-run row (one per run, node and iteration). */
async function writeStep(
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

async function loadDefinition(
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

async function workflowName(tx: StoreTx, id: string): Promise<string> {
  const [w] = await tx
    .select({ name: automationWorkflow.name })
    .from(automationWorkflow)
    .where(eq(automationWorkflow.id, id))
  return w?.name ?? ''
}

/** Subject data plus the trigger snapshot under `trigger`. */
async function subjectData(
  tx: StoreTx,
  run: RunRow,
  deps: EngineDeps,
): Promise<SubjectData | null> {
  const subject: RunSubject = { type: run.subjectType, id: run.subjectId }
  const loaded = subject.id ? await deps.loadSubject(tx, run.storeId, subject) : {}
  if (!loaded) return null
  return { ...loaded, trigger: run.triggerData }
}

function runCondition(
  node: ConditionNode,
  data: SubjectData,
  deps: EngineDeps,
): { pass: boolean; output: Record<string, unknown> } {
  const result = deps.evaluate(node.rules, data)
  return { pass: result.pass, output: { trace: result.trace } }
}

async function doCondition(
  tx: StoreTx,
  run: RunRow,
  node: ConditionNode,
  data: SubjectData,
  deps: EngineDeps,
  now: Date,
): Promise<StepOutcome> {
  const { pass, output } = runCondition(node, data, deps)
  await writeStep(tx, run, node, null, {
    status: pass ? 'then' : 'otherwise',
    output,
    startedAt: now,
    finishedAt: now,
  })
  const next = pass ? node.next : node.otherwise
  if (!pass && next === null && node.otherwiseStops) {
    return finish(tx, run.id, 'stopped', now, { stopReason: 'condition' })
  }
  return moveTo(tx, run.id, next)
}

async function doWait(tx: StoreTx, run: RunRow, node: WaitNode, now: Date): Promise<StepOutcome> {
  const until = new Date(now.getTime() + node.minutes * 60_000)
  await writeStep(tx, run, node, null, {
    status: 'succeeded',
    output: { until: until.toISOString() },
    startedAt: now,
    finishedAt: now,
  })
  await tx
    .update(automationRun)
    .set({ cursor: node.next, status: 'waiting', nextAt: until })
    .where(eq(automationRun.id, run.id))
  return { kind: 'park', status: 'waiting', nextAt: until }
}

function actionContext(
  run: RunRow,
  node: ActionNode,
  data: SubjectData,
  attempt: number,
  name: string,
  deps: EngineDeps,
): ActionContext {
  const cause: AutomationCause = {
    runId: run.id,
    workflowId: run.workflowId,
    depth: run.depth + 1,
  }
  return {
    storeId: run.storeId,
    workflow: { id: run.workflowId, name, versionId: run.versionId },
    runId: run.id,
    nodeId: node.id,
    stepKey: `${run.id}:${node.id}:0`,
    attempt,
    subject: { type: run.subjectType, id: run.subjectId },
    data,
    triggerData: run.triggerData,
    cause,
    dryRun: false,
    render: (template) => renderMergeTags(template, data),
    log: (m) => deps.log?.(`[automations] ${run.id}/${node.id}: ${m}`),
  }
}

/** On a failed step: retry later, carry on, or fail the run. */
async function onActionError(
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

async function doAction(
  tx: StoreTx,
  run: RunRow,
  node: ActionNode,
  data: SubjectData,
  deps: EngineDeps,
  now: Date,
): Promise<StepOutcome> {
  const existing = await stepRow(tx, run.id, node.id)
  // Exactly once: a node that already succeeded is never run again.
  if (existing?.status === 'succeeded') return moveTo(tx, run.id, node.next)

  const resolved = await (deps.resolveAction ?? defaultResolve)(tx, run.storeId, node.action)
  if (!resolved) {
    await writeStep(tx, run, node, node.action, {
      status: 'failed',
      error: 'This action is not available',
      startedAt: now,
      finishedAt: now,
    })
    if (node.onError === 'continue') return moveTo(tx, run.id, node.next)
    return finish(tx, run.id, 'failed', now, { error: `Action ${node.action} is not available` })
  }
  const parsed = resolved.descriptor.configSchema.safeParse(node.config)
  const name = await workflowName(tx, run.workflowId)
  const attempt = existing ? existing.attempt + (existing.status === 'failed' ? 1 : 0) : 1
  const ctx = actionContext(run, node, data, attempt, name, deps)

  // Ask before running (design §8.7): park until a member decides.
  if (nodeNeedsApproval(resolved.descriptor, node.needsApproval)) {
    if (existing?.status === 'cancelled') {
      const reason =
        existing.error === 'approval_expired' ? 'approval_expired' : 'approval_declined'
      if (node.onError === 'continue') return moveTo(tx, run.id, node.next)
      return finish(tx, run.id, 'stopped', now, { stopReason: reason })
    }
    // Decided once: a retry after an approved attempt does not ask again.
    const approved = existing?.decidedAt != null
    if (!approved) {
      if (existing?.status === 'awaiting_approval') {
        return { kind: 'park', status: 'awaiting_approval', nextAt: null }
      }
      const preview = parsed.success
        ? await resolved.executor.preview({
            tx,
            ctx: { ...ctx, dryRun: true },
            config: parsed.data,
          })
        : { summary: 'Check this step', wouldRun: false }
      await writeStep(tx, run, node, node.action, {
        status: 'awaiting_approval',
        input: node.config,
        output: { preview },
        summary: preview.summary,
        approvalExpiresAt: new Date(now.getTime() + APPROVAL_EXPIRY_HOURS * 3600_000),
        startedAt: now,
      })
      await tx
        .update(automationRun)
        .set({ status: 'awaiting_approval' })
        .where(eq(automationRun.id, run.id))
      return { kind: 'park', status: 'awaiting_approval', nextAt: null }
    }
  }

  if (!parsed.success) {
    return onActionError(
      tx,
      run,
      node,
      resolved,
      attempt,
      new AutomationActionError('This step is not filled in correctly', { retryable: false }),
      now,
    )
  }
  try {
    // A savepoint: a failing executor's partial writes roll back, the step-run row stays.
    const result = await tx.transaction((sp) =>
      resolved.executor.run({ tx: sp, ctx, config: parsed.data }),
    )
    await writeStep(tx, run, node, node.action, {
      status: 'succeeded',
      attempt,
      input: node.config,
      output: truncateOutput(result.output),
      summary: result.summary ?? null,
      error: null,
      retryAt: null,
      finishedAt: now,
    })
    for (const rec of result.changed ?? []) {
      await tx
        .insert(automationRunRecord)
        .values({
          runId: run.id,
          storeId: run.storeId,
          recordType: rec.type,
          recordId: rec.id,
          role: 'changed',
        })
        .onConflictDoNothing()
    }
    return moveTo(tx, run.id, node.next)
  } catch (err) {
    return onActionError(tx, run, node, resolved, attempt, err, now)
  }
}

/** One node of one run, in the caller's transaction. */
async function stepOnce(
  tx: StoreTx,
  runId: string,
  deps: EngineDeps,
  cache: Map<string, WorkflowDefinition | null>,
): Promise<StepOutcome> {
  const now = deps.now?.() ?? new Date()
  const [run] = await tx
    .select()
    .from(automationRun)
    .where(eq(automationRun.id, runId))
    .for('update', { skipLocked: true })
  // Another job holds it, or it is gone.
  if (!run) return { kind: 'done' }
  if (run.status === 'waiting' && run.nextAt > now) {
    return { kind: 'park', status: 'waiting', nextAt: run.nextAt }
  }
  if (run.status !== 'queued' && run.status !== 'running' && run.status !== 'waiting') {
    return { kind: 'done' }
  }
  const def = await loadDefinition(tx, run.versionId, cache)
  if (!def)
    return finish(tx, run.id, 'failed', now, { error: 'The workflow version is unreadable' })
  if (run.cursor === null) return finish(tx, run.id, 'completed', now)
  const node = def.nodes[run.cursor]
  if (!node) return finish(tx, run.id, 'failed', now, { error: `Step ${run.cursor} is missing` })

  if (def.settings.exitOnOrder && deps.exitCheck) {
    const exit = await deps.exitCheck(tx, run, def)
    if (exit) {
      return finish(tx, run.id, exit.status, now, {
        stopReason: exit.reason ?? null,
        convertedOrderId: exit.convertedOrderId ?? null,
      })
    }
  }
  if (run.status !== 'running') {
    await tx.update(automationRun).set({ status: 'running' }).where(eq(automationRun.id, run.id))
  }
  if (node.kind === 'wait') return doWait(tx, run, node, now)
  const data = await subjectData(tx, run, deps)
  if (!data) return finish(tx, run.id, 'stopped', now, { stopReason: 'subject_missing' })
  if (node.kind === 'condition') return doCondition(tx, run, node, data, deps, now)
  return doAction(tx, run, node, data, deps, now)
}

export type AdvanceResult = {
  /** Nodes walked by this call. */
  nodes: number
  /** Where the run was left: `waiting` with its due time, `awaiting_approval`, or done. */
  parked: { status: RunStatus; nextAt: Date | null } | null
}

/**
 * Walks a run until it waits, asks, ends or fails. Each node commits on its own, so a crash
 * mid-run resumes at the node after the last committed one. Safe to call twice at once: the
 * second call finds the row locked and returns.
 */
export async function advanceRun(
  db: Db,
  storeId: string,
  runId: string,
  deps: EngineDeps,
): Promise<AdvanceResult> {
  const cache = new Map<string, WorkflowDefinition | null>()
  let nodes = 0
  while (nodes < MAX_NODES_PER_JOB) {
    const outcome = await withStore(db, storeId, (tx) => stepOnce(tx, runId, deps, cache))
    if (outcome.kind === 'done') return { nodes, parked: null }
    if (outcome.kind === 'park')
      return { nodes, parked: { status: outcome.status, nextAt: outcome.nextAt } }
    nodes += 1
  }
  return { nodes, parked: { status: 'running', nextAt: new Date() } }
}
