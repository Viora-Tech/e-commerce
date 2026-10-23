/** SOURCE OF TRUTH: run service — WHAT: the run log (list, detail with steps and path), retry from the failed step, cancel, "Run automation" on records, the manual workflows a record can run, record history, approvals (list, approve, decline) and Test with a record / WHY: the `automations.*` router, the record pages and the Growth stats read runs through one place, with customer data hidden from members without customers.read (design §8.6, §8.7). */
import {
  automationRun,
  automationRunRecord,
  automationStepRun,
  automationVersion,
  automationWorkflow,
  customer,
  order,
  product,
  type StoreTx,
} from '@commerce/db'
import type { PluginManifest } from '@commerce/plugins'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { ALL_PERMISSIONS, type Permission, permissions } from '../../permissions/statement'
import type {
  ApprovalItem,
  ManualWorkflow,
  RecordHistoryItem,
  RunDetail,
  RunPage,
  RunSummary,
  StepRunView,
  SubjectLabel,
  TestRunResult,
} from '../api-types'
import { nodeNeedsApproval } from '../catalogue'
import { type WorkflowDefinition, WorkflowDefinitionSchema } from '../definition'
import type { ConditionEvaluator, SubjectLoader } from '../executor'
import { pieceIssues } from '../registry'
import { OPEN_RUN_STATUSES, type RunStatus } from '../types'
import { dryRun } from './dry-run'
import { actionResolver, storePieces } from './resolve'
import { type StartedRun, startRuns } from './trigger'
import { storePlanId } from './usage'
import { getWorkflow, type Member, WorkflowError } from './workflows'

type RunRow = typeof automationRun.$inferSelect
const iso = (d: Date | null) => (d ? d.toISOString() : null)
const holds = (m: Member, p: Permission) => m.isOwner || m.permissions.includes(p)

/** "#1042", "Asha Rao", "Cotton kurta": what the run log calls each subject. */
async function subjectLabels(tx: StoreTx, runs: Pick<RunRow, 'subjectType' | 'subjectId'>[]) {
  const ids = (type: string) => [
    ...new Set(
      runs.filter((r) => r.subjectType === type && r.subjectId).map((r) => r.subjectId as string),
    ),
  ]
  const labels = new Map<string, string>()
  const orderIds = ids('order')
  if (orderIds.length) {
    for (const o of await tx
      .select({ id: order.id, number: order.number })
      .from(order)
      .where(inArray(order.id, orderIds)))
      labels.set(o.id, `#${o.number}`)
  }
  const customerIds = ids('customer')
  if (customerIds.length) {
    for (const c of await tx
      .select({ id: customer.id, name: customer.name, email: customer.email })
      .from(customer)
      .where(inArray(customer.id, customerIds)))
      labels.set(c.id, c.name || c.email || 'Customer')
  }
  const productIds = ids('product')
  if (productIds.length) {
    for (const p of await tx
      .select({ id: product.id, title: product.title })
      .from(product)
      .where(inArray(product.id, productIds)))
      labels.set(p.id, p.title)
  }
  return (r: Pick<RunRow, 'subjectType' | 'subjectId'>): SubjectLabel => ({
    type: r.subjectType,
    id: r.subjectId,
    label: r.subjectId ? (labels.get(r.subjectId) ?? 'Deleted record') : '',
  })
}

type Joined = { run: RunRow; workflowName: string; versionNumber: number }

function toSummary(j: Joined, label: (r: RunRow) => SubjectLabel): RunSummary {
  const r = j.run
  return {
    id: r.id,
    workflowId: r.workflowId,
    workflowName: j.workflowName,
    versionNumber: j.versionNumber,
    status: r.status,
    triggerType: r.triggerType,
    subject: label(r),
    isTest: r.isTest,
    manual: r.requestedBy !== null,
    stopReason: r.stopReason,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: iso(r.finishedAt),
    nextAt: r.status === 'waiting' ? r.nextAt.toISOString() : null,
  }
}

const joinedRuns = (tx: StoreTx) =>
  tx
    .select({
      run: automationRun,
      workflowName: automationWorkflow.name,
      versionNumber: automationVersion.number,
    })
    .from(automationRun)
    .innerJoin(automationWorkflow, eq(automationWorkflow.id, automationRun.workflowId))
    .innerJoin(automationVersion, eq(automationVersion.id, automationRun.versionId))

/** Runs newest first. The cursor is the last row's `startedAt|id`. */
export async function listRuns(
  tx: StoreTx,
  input: {
    workflowId?: string | undefined
    status?: RunStatus | undefined
    record?: { type: string; id: string } | undefined
    cursor?: string | undefined
    limit: number
  },
): Promise<RunPage> {
  const [at, id] = input.cursor ? input.cursor.split('|') : [null, null]
  const recordRuns = input.record
    ? tx
        .select({ id: automationRunRecord.runId })
        .from(automationRunRecord)
        .where(
          and(
            eq(automationRunRecord.recordType, input.record.type),
            eq(automationRunRecord.recordId, input.record.id),
          ),
        )
    : null
  const rows = await joinedRuns(tx)
    .where(
      and(
        ...(input.workflowId ? [eq(automationRun.workflowId, input.workflowId)] : []),
        ...(input.status ? [eq(automationRun.status, input.status)] : []),
        ...(recordRuns ? [inArray(automationRun.id, recordRuns)] : []),
        ...(at && id
          ? [sql`(${automationRun.startedAt}, ${automationRun.id}) < (${new Date(at)}, ${id})`]
          : []),
      ),
    )
    .orderBy(desc(automationRun.startedAt), desc(automationRun.id))
    .limit(input.limit + 1)
  const page = rows.slice(0, input.limit)
  const label = await subjectLabels(
    tx,
    page.map((r) => r.run),
  )
  const last = page.at(-1)
  return {
    runs: page.map((j) => toSummary(j, label)),
    nextCursor:
      rows.length > input.limit && last
        ? `${last.run.startedAt.toISOString()}|${last.run.id}`
        : null,
  }
}

function stepView(s: typeof automationStepRun.$inferSelect, showData: boolean): StepRunView {
  return {
    id: s.id,
    nodeId: s.nodeId,
    kind: s.kind as StepRunView['kind'],
    actionId: s.actionId,
    status: s.status,
    attempt: s.attempt,
    input: showData ? (s.input ?? null) : null,
    output: showData ? (s.output ?? null) : null,
    summary: s.summary,
    error: s.error,
    startedAt: s.startedAt.toISOString(),
    finishedAt: iso(s.finishedAt),
    approval:
      s.approvalExpiresAt || s.decidedAt
        ? {
            expiresAt: iso(s.approvalExpiresAt),
            decidedBy: s.decidedBy,
            decidedAt: iso(s.decidedAt),
          }
        : null,
  }
}

export async function getRun(tx: StoreTx, id: string, member: Member): Promise<RunDetail | null> {
  const [j] = await joinedRuns(tx).where(eq(automationRun.id, id))
  if (!j) return null
  const [version] = await tx
    .select({ definition: automationVersion.definition })
    .from(automationVersion)
    .where(eq(automationVersion.id, j.run.versionId))
  const parsed = WorkflowDefinitionSchema.safeParse(version?.definition)
  const steps = await tx
    .select()
    .from(automationStepRun)
    .where(eq(automationStepRun.runId, id))
    .orderBy(asc(automationStepRun.startedAt))
  const label = await subjectLabels(tx, [j.run])
  const showData = holds(member, permissions.CUSTOMERS_READ)
  return {
    ...toSummary(j, label),
    definition: parsed.success
      ? parsed.data
      : {
          schemaVersion: 1,
          trigger: { type: j.run.triggerType, config: {} },
          start: null,
          nodes: {},
          settings: {},
        },
    steps: steps.map((s) => stepView(s, showData)),
    path: steps.map((s) => s.nodeId),
    canRetry: j.run.status === 'failed',
    canCancel: (OPEN_RUN_STATUSES as readonly string[]).includes(j.run.status),
  }
}

async function runOrThrow(tx: StoreTx, id: string): Promise<RunRow> {
  const [r] = await tx.select().from(automationRun).where(eq(automationRun.id, id))
  if (!r) throw new WorkflowError('NOT_FOUND', 'Run not found')
  return r
}

/** Retry from the failed step: same run, the failed node runs again (attempt + 1). */
export async function retryRun(tx: StoreTx, id: string): Promise<StartedRun> {
  const r = await runOrThrow(tx, id)
  if (r.status !== 'failed')
    throw new WorkflowError('PRECONDITION_FAILED', 'Only failed runs can be retried')
  const now = new Date()
  await tx
    .update(automationRun)
    .set({ status: 'queued', nextAt: now, error: null, finishedAt: null })
    .where(eq(automationRun.id, id))
  return { runId: id, workflowId: r.workflowId, nextAt: now }
}

export async function cancelRun(tx: StoreTx, id: string): Promise<void> {
  const r = await runOrThrow(tx, id)
  if (!(OPEN_RUN_STATUSES as readonly string[]).includes(r.status)) {
    throw new WorkflowError('PRECONDITION_FAILED', 'This run already finished')
  }
  const now = new Date()
  await tx
    .update(automationRun)
    .set({ status: 'cancelled', stopReason: 'cancelled_by_member', finishedAt: now })
    .where(eq(automationRun.id, id))
  await tx
    .update(automationStepRun)
    .set({ status: 'cancelled', finishedAt: now })
    .where(and(eq(automationStepRun.runId, id), eq(automationStepRun.status, 'awaiting_approval')))
}

async function liveDefinition(tx: StoreTx, workflowId: string): Promise<WorkflowDefinition | null> {
  const [v] = await tx
    .select({ definition: automationVersion.definition })
    .from(automationWorkflow)
    .innerJoin(automationVersion, eq(automationVersion.id, automationWorkflow.publishedVersionId))
    .where(eq(automationWorkflow.id, workflowId))
  const parsed = v ? WorkflowDefinitionSchema.safeParse(v.definition) : null
  return parsed?.success ? parsed.data : null
}

/** On workflows with this record type's manual trigger, and whether this member may run each. */
export async function listManualWorkflows(
  tx: StoreTx,
  storeId: string,
  subjectType: 'order' | 'customer' | 'product',
  member: Member,
  plugins: readonly PluginManifest[],
): Promise<ManualWorkflow[]> {
  const rows = await tx
    .select({ id: automationWorkflow.id, name: automationWorkflow.name })
    .from(automationWorkflow)
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        eq(automationWorkflow.status, 'on'),
        eq(automationWorkflow.triggerType, `manual.${subjectType}`),
      ),
    )
    .orderBy(asc(automationWorkflow.name))
  const pieces = await storePieces(tx, storeId, plugins)
  const plan = await storePlanId(tx, storeId)
  const out: ManualWorkflow[] = []
  for (const w of rows) {
    const def = await liveDefinition(tx, w.id)
    if (!def) continue
    const actions = Object.values(def.nodes).flatMap((n) => {
      if (n.kind !== 'action') return []
      const d = pieces.catalogue.action(n.action)
      return [
        { actionId: n.action, needsApproval: d ? nodeNeedsApproval(d, n.needsApproval) : false },
      ]
    })
    const issues = pieceIssues(def, {
      catalogue: pieces.catalogue,
      plan,
      memberPermissions: member.isOwner ? ALL_PERMISSIONS : member.permissions,
      isOwner: member.isOwner,
    })
    const [last] = await tx
      .select({ at: sql<Date | null>`max(${automationRun.startedAt})` })
      .from(automationRun)
      .where(eq(automationRun.workflowId, w.id))
    out.push({
      id: w.id,
      name: w.name,
      actions,
      allowed: issues.length === 0,
      lastRunAt: last?.at ? new Date(last.at).toISOString() : null,
    })
  }
  return out
}

/**
 * "Run automation" on records: one run per record, keyed `manual:<requestId>:<recordId>` so a
 * double click starts nothing twice. The member must hold every action's own permission.
 */
export async function runNow(
  tx: StoreTx,
  storeId: string,
  input: {
    workflowId: string
    subjectType: 'order' | 'customer' | 'product'
    ids: string[]
    requestId: string
  },
  member: Member,
  plugins: readonly PluginManifest[],
): Promise<{ started: StartedRun[]; skipped: number }> {
  const manual = await listManualWorkflows(tx, storeId, input.subjectType, member, plugins)
  const wf = manual.find((w) => w.id === input.workflowId)
  if (!wf)
    throw new WorkflowError('NOT_FOUND', 'This workflow is off or cannot run on these records')
  if (!wf.allowed)
    throw new WorkflowError('FORBIDDEN', 'Your role cannot do every step of this workflow')
  const started: StartedRun[] = []
  let skipped = 0
  for (const id of input.ids) {
    const r = await startRuns(tx, storeId, {
      triggerIds: [`manual.${input.subjectType}`],
      key: `manual:${input.requestId}:${id}`,
      subject: { type: input.subjectType, id },
      data: { requestId: input.requestId },
      cause: null,
      requestedBy: member.userId,
      workflowIds: [input.workflowId],
    })
    started.push(...r.started)
    skipped += r.skipped.length
  }
  return { started, skipped }
}

export async function recordHistory(
  tx: StoreTx,
  input: { type: string; id: string; limit: number },
): Promise<RecordHistoryItem[]> {
  const rows = await tx
    .select({
      runId: automationRun.id,
      workflowId: automationRun.workflowId,
      workflowName: automationWorkflow.name,
      status: automationRun.status,
      role: automationRunRecord.role,
      startedAt: automationRun.startedAt,
    })
    .from(automationRunRecord)
    .innerJoin(automationRun, eq(automationRun.id, automationRunRecord.runId))
    .innerJoin(automationWorkflow, eq(automationWorkflow.id, automationRun.workflowId))
    .where(
      and(
        eq(automationRunRecord.recordType, input.type),
        eq(automationRunRecord.recordId, input.id),
      ),
    )
    .orderBy(desc(automationRun.startedAt))
    .limit(input.limit)
  return rows.map((r) => ({ ...r, startedAt: r.startedAt.toISOString() }))
}

export async function listApprovals(
  tx: StoreTx,
  storeId: string,
  member: Member,
  plugins: readonly PluginManifest[],
): Promise<ApprovalItem[]> {
  const rows = await tx
    .select({ step: automationStepRun, run: automationRun, workflowName: automationWorkflow.name })
    .from(automationStepRun)
    .innerJoin(automationRun, eq(automationRun.id, automationStepRun.runId))
    .innerJoin(automationWorkflow, eq(automationWorkflow.id, automationRun.workflowId))
    .where(eq(automationStepRun.status, 'awaiting_approval'))
    .orderBy(asc(automationStepRun.startedAt))
  const pieces = await storePieces(tx, storeId, plugins)
  const label = await subjectLabels(
    tx,
    rows.map((r) => r.run),
  )
  return rows.map(({ step, run, workflowName }) => {
    const d = step.actionId ? pieces.catalogue.action(step.actionId) : null
    return {
      stepRunId: step.id,
      runId: run.id,
      workflowId: run.workflowId,
      workflowName,
      actionId: step.actionId ?? '',
      summary: step.summary,
      subject: label(run),
      requestedAt: step.startedAt.toISOString(),
      expiresAt: iso(step.approvalExpiresAt),
      canDecide: d ? holds(member, d.permission) : member.isOwner,
    }
  })
}

/**
 * Approve or decline a waiting step. Any member holding the action's own permission may
 * decide (Cancel order: orders.cancel). The run is queued again either way: approved, the
 * action runs; declined, the run follows the node's `onError`.
 */
export async function decideApproval(
  tx: StoreTx,
  storeId: string,
  input: { stepRunId: string; approve: boolean },
  member: Member,
  plugins: readonly PluginManifest[],
): Promise<{ item: ApprovalItem; run: StartedRun }> {
  const [row] = await tx
    .select({ step: automationStepRun, run: automationRun })
    .from(automationStepRun)
    .innerJoin(automationRun, eq(automationRun.id, automationStepRun.runId))
    .where(eq(automationStepRun.id, input.stepRunId))
  if (row?.step.status !== 'awaiting_approval') {
    throw new WorkflowError('NOT_FOUND', 'Nothing is waiting for approval here')
  }
  const items = await listApprovals(tx, storeId, member, plugins)
  const item = items.find((i) => i.stepRunId === input.stepRunId)
  if (!item?.canDecide) throw new WorkflowError('FORBIDDEN', 'Your role cannot approve this step')
  const now = new Date()
  await tx
    .update(automationStepRun)
    .set(
      input.approve
        ? { status: 'running', decidedBy: member.userId, decidedAt: now }
        : {
            status: 'cancelled',
            error: 'approval_declined',
            decidedBy: member.userId,
            decidedAt: now,
            finishedAt: now,
          },
    )
    .where(eq(automationStepRun.id, input.stepRunId))
  await tx
    .update(automationRun)
    .set({ status: 'queued', nextAt: now })
    .where(eq(automationRun.id, row.run.id))
  return { item, run: { runId: row.run.id, workflowId: row.run.workflowId, nextAt: now } }
}

/** Test with a record: the draft (or the given definition) walked against real data. */
export async function testWorkflow(
  tx: StoreTx,
  storeId: string,
  input: {
    id: string
    definition?: WorkflowDefinition | undefined
    subject: { type: string; id: string } | null
  },
  deps: {
    evaluate: ConditionEvaluator
    loadSubject: SubjectLoader
    plugins: readonly PluginManifest[]
  },
): Promise<TestRunResult> {
  const wf = await getWorkflow(tx, input.id)
  if (!wf) throw new WorkflowError('NOT_FOUND', 'Workflow not found')
  const def = input.definition ?? wf.definition
  const result = await dryRun(
    tx,
    storeId,
    { workflow: { id: wf.id, name: wf.name }, def, subject: input.subject },
    {
      evaluate: deps.evaluate,
      loadSubject: deps.loadSubject,
      resolveAction: actionResolver({ plugins: deps.plugins }),
    },
  )
  if (input.subject && result.subject) {
    const label = await subjectLabels(tx, [
      { subjectType: input.subject.type, subjectId: input.subject.id },
    ])
    result.subject = label({ subjectType: input.subject.type, subjectId: input.subject.id })
  }
  return result
}
