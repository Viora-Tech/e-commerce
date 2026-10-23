/** SOURCE OF TRUTH: the automation interpreter — WHAT: advances one run node by node (condition → branch, action → executor with approval, retries and onError, wait → park), each node in its own store transaction with its step-run row, until the run waits, asks, ends or fails / WHY: the DB row is the run's only state, so a crash, a Redis loss or a duplicate job never loses or repeats an internal action (design §8.5). */
import {
  automationRun,
  automationRunRecord,
  automationVersion,
  automationWorkflow,
  type Db,
  type StoreTx,
  withStore,
} from '@commerce/db'
import { eq } from 'drizzle-orm'
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
  type RunReason,
  type RunStatus,
} from '../types'
import {
  finish,
  moveTo,
  onActionError,
  type RunRow,
  type StepOutcome,
  stepRow,
  truncateOutput,
  writeStep,
} from './steps'

export { retryDelayMs } from './steps'

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
  /**
   * Runs before every node of every run (Growth's conversion and unsubscribe exits live here);
   * returns null for runs it does not own.
   */
  exitCheck?:
    | ((tx: StoreTx, run: RunRow, def: WorkflowDefinition) => Promise<ExitDecision | null>)
    | undefined
  log?: ((message: string) => void) | undefined
  now?: (() => Date) | undefined
}

/** Nodes one step job walks before handing back (a workflow has at most 50). */
const MAX_NODES_PER_JOB = 60

async function defaultResolve(
  _tx: StoreTx,
  _storeId: string,
  id: string,
): Promise<ResolvedAction | null> {
  const descriptor = builtinAction(id)
  const executor = actionExecutor(id)
  return descriptor && executor ? { descriptor, executor } : null
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

/** True for an Off Growth workflow: its runs wait, neither advancing nor ending. */
async function isHeld(tx: StoreTx, workflowId: string): Promise<boolean> {
  const [w] = await tx
    .select({ status: automationWorkflow.status, origin: automationWorkflow.origin })
    .from(automationWorkflow)
    .where(eq(automationWorkflow.id, workflowId))
  return w?.status === 'off' && w.origin === 'growth'
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

  // A paused Growth workflow holds its runs where they are (Growth parity); switching it back
  // on lets the tick pick them up. Other workflows' runs finish after an Off (design §8.5).
  if (await isHeld(tx, run.workflowId)) {
    return { kind: 'park', status: run.status, nextAt: null }
  }
  // Every run asks: Growth's hook also stops unsubscribed customers on triggers without
  // `exitOnOrder`; the hook returns null for runs it does not own.
  if (deps.exitCheck) {
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
