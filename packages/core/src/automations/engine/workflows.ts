/** SOURCE OF TRUTH: workflow service — WHAT: list, get, create (template or trigger), update draft, publish (piece, plan, permission and typed-confirm checks, immutable version), switch on/off (with "cancel or finish waiting runs"), restore a version, duplicate, delete, and the editor's catalogue, templates and usage / WHY: the `automations.*` router and Growth's rewired editor share these, so a workflow is published and limited the same way from every surface (design §8.3, §8.7). */
import { automationRun, automationVersion, automationWorkflow, type StoreTx } from '@commerce/db'
import type { PluginManifest } from '@commerce/plugins'
import { and, desc, eq, ilike, inArray, max, sql } from 'drizzle-orm'
import { CommerceError } from '../../errors'
import { ALL_PERMISSIONS, type Permission } from '../../permissions/statement'
import type { PublishResult, WorkflowDetail, WorkflowSummary } from '../api-types'
import {
  actionIdsOf,
  emptyDefinition,
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
} from '../definition'
import { pieceIssues } from '../registry'
import { builtinTemplate } from '../templates'
import { OPEN_RUN_STATUSES, type WorkflowOrigin, type WorkflowStatus } from '../types'
import { storePieces } from './resolve'
import { nextFireAt, type ScheduleConfig } from './tick'
import { canTurnOnAnother, storePlanId } from './usage'

/** Who is asking, as the API's store scope has it. */
export type Member = { userId: string; isOwner: boolean; permissions: readonly Permission[] }

export type WorkflowErrorCode = 'NOT_FOUND' | 'PRECONDITION_FAILED' | 'FORBIDDEN' | 'BAD_REQUEST'

/** A refusal the router turns into the matching oRPC error. */
export class WorkflowError extends CommerceError {
  readonly reason: WorkflowErrorCode
  constructor(reason: WorkflowErrorCode, message: string) {
    super(`AUTOMATION_${reason}`, message)
    this.reason = reason
  }
}

type WorkflowRow = typeof automationWorkflow.$inferSelect

const iso = (d: Date | null) => (d ? d.toISOString() : null)

function parseDef(value: unknown): WorkflowDefinition | null {
  const parsed = WorkflowDefinitionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Growth's linear editor can open it: no branch, only marketing pieces (design §9.4). */
function linear(def: WorkflowDefinition | null): boolean {
  if (!def) return true
  return Object.values(def.nodes).every((n) => {
    if (n.kind === 'condition') return n.otherwise === null
    if (n.kind === 'action') return n.action.startsWith('marketing.')
    return true
  })
}

async function runStats(tx: StoreTx, ids: string[]) {
  const stats = new Map<string, { runs: number; last: Date | null }>()
  if (ids.length === 0) return stats
  const since = new Date(Date.now() - 30 * 86_400_000)
  const rows = await tx
    .select({
      workflowId: automationRun.workflowId,
      runs: sql<number>`count(*) filter (where ${automationRun.startedAt} >= ${since})::int`,
      last: max(automationRun.startedAt),
    })
    .from(automationRun)
    .where(inArray(automationRun.workflowId, ids))
    .groupBy(automationRun.workflowId)
  for (const r of rows) stats.set(r.workflowId, { runs: r.runs, last: r.last })
  return stats
}

async function versionNumbers(tx: StoreTx, ids: (string | null)[]) {
  const real = ids.filter((x): x is string => Boolean(x))
  if (real.length === 0) return new Map<string, number>()
  const rows = await tx
    .select({ id: automationVersion.id, number: automationVersion.number })
    .from(automationVersion)
    .where(inArray(automationVersion.id, real))
  return new Map(rows.map((r) => [r.id, r.number]))
}

function summary(
  w: WorkflowRow,
  stats: { runs: number; last: Date | null } | undefined,
  version: number | null,
): WorkflowSummary {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    status: w.status,
    origin: w.origin,
    templateId: w.templateId,
    triggerType: w.triggerType,
    hasDraft: w.draftDefinition !== null,
    publishedVersion: version,
    problem: w.problem,
    runsLast30Days: stats?.runs ?? 0,
    lastRunAt: iso(stats?.last ?? null),
    updatedAt: w.updatedAt.toISOString(),
  }
}

export async function listWorkflows(
  tx: StoreTx,
  storeId: string,
  filter: {
    origin?: WorkflowOrigin | undefined
    status?: WorkflowStatus | undefined
    query?: string | undefined
  } = {},
): Promise<WorkflowSummary[]> {
  const rows = await tx
    .select()
    .from(automationWorkflow)
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        ...(filter.origin ? [eq(automationWorkflow.origin, filter.origin)] : []),
        ...(filter.status ? [eq(automationWorkflow.status, filter.status)] : []),
        ...(filter.query ? [ilike(automationWorkflow.name, `%${filter.query}%`)] : []),
      ),
    )
    .orderBy(desc(automationWorkflow.updatedAt))
  const [stats, versions] = await Promise.all([
    runStats(
      tx,
      rows.map((r) => r.id),
    ),
    versionNumbers(
      tx,
      rows.map((r) => r.publishedVersionId),
    ),
  ])
  return rows.map((w) =>
    summary(
      w,
      stats.get(w.id),
      w.publishedVersionId ? (versions.get(w.publishedVersionId) ?? null) : null,
    ),
  )
}

async function row(tx: StoreTx, id: string): Promise<WorkflowRow> {
  const [w] = await tx.select().from(automationWorkflow).where(eq(automationWorkflow.id, id))
  if (!w) throw new WorkflowError('NOT_FOUND', 'Workflow not found')
  return w
}

export async function getWorkflow(tx: StoreTx, id: string): Promise<WorkflowDetail | null> {
  const [w] = await tx.select().from(automationWorkflow).where(eq(automationWorkflow.id, id))
  if (!w) return null
  const versions = await tx
    .select()
    .from(automationVersion)
    .where(eq(automationVersion.workflowId, id))
    .orderBy(desc(automationVersion.number))
  const live = versions.find((v) => v.id === w.publishedVersionId)
  const published = live ? parseDef(live.definition) : null
  const definition =
    (w.draftDefinition ? parseDef(w.draftDefinition) : null) ??
    published ??
    emptyDefinition(w.triggerType)
  const [stats, [open = { n: 0 }]] = await Promise.all([
    runStats(tx, [id]),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(automationRun)
      .where(
        and(
          eq(automationRun.workflowId, id),
          inArray(automationRun.status, [...OPEN_RUN_STATUSES]),
        ),
      ),
  ])
  return {
    ...summary(w, stats.get(id), live?.number ?? null),
    definition,
    published,
    versions: versions.map((v) => ({
      id: v.id,
      number: v.number,
      publishedAt: v.publishedAt.toISOString(),
      publishedBy: v.publishedBy,
    })),
    openRuns: open.n,
    editableInGrowth: linear(definition),
  }
}

async function detail(tx: StoreTx, id: string): Promise<WorkflowDetail> {
  const d = await getWorkflow(tx, id)
  if (!d) throw new WorkflowError('NOT_FOUND', 'Workflow not found')
  return d
}

/** A fresh copy of a definition (templates are shared objects). */
const clone = (def: WorkflowDefinition): WorkflowDefinition => structuredClone(def)

export async function createWorkflow(
  tx: StoreTx,
  storeId: string,
  input: {
    templateId?: string | undefined
    triggerType?: string | undefined
    name?: string | undefined
  },
  member: Member,
): Promise<WorkflowDetail> {
  let def: WorkflowDefinition
  let name = input.name
  let templateId: string | null = null
  if (input.templateId) {
    const tpl = builtinTemplate(input.templateId)
    if (!tpl) throw new WorkflowError('NOT_FOUND', 'Unknown template')
    def = clone(tpl.definition)
    templateId = tpl.id
    name ??= tpl.id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
  } else {
    def = emptyDefinition(input.triggerType ?? 'manual.order')
    name ??= 'Untitled workflow'
  }
  const [w] = await tx
    .insert(automationWorkflow)
    .values({
      storeId,
      name,
      status: 'off',
      origin: 'automations',
      templateId,
      triggerType: def.trigger.type,
      draftDefinition: def,
      createdBy: member.userId,
    })
    .returning({ id: automationWorkflow.id })
  return detail(tx, (w as { id: string }).id)
}

export async function updateWorkflow(
  tx: StoreTx,
  input: {
    id: string
    name?: string | undefined
    description?: string | undefined
    draft?: WorkflowDefinition | undefined
  },
): Promise<WorkflowDetail> {
  await row(tx, input.id)
  await tx
    .update(automationWorkflow)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.draft !== undefined ? { draftDefinition: input.draft } : {}),
      updatedAt: new Date(),
    })
    .where(eq(automationWorkflow.id, input.id))
  return detail(tx, input.id)
}

/**
 * Publishes the draft as the next version. Checks the tree, every piece (known, configured,
 * on the plan, permission held by the publisher, Owner-only approval switches) and asks for the
 * workflow's name typed out when a sensitive action is in it.
 */
export async function publishWorkflow(
  tx: StoreTx,
  storeId: string,
  input: { id: string; confirmName?: string | undefined; turnOn: boolean },
  member: Member,
  plugins: readonly PluginManifest[],
): Promise<PublishResult> {
  const w = await row(tx, input.id)
  const current = await getWorkflow(tx, input.id)
  const def = current?.definition
  if (!def || def.start === null) {
    return {
      ok: false,
      needsConfirm: false,
      issues: [{ nodeId: null, code: 'empty', message: 'Add a step first' }],
    }
  }
  const parsed = WorkflowDefinitionSchema.safeParse(def)
  if (!parsed.success) {
    return {
      ok: false,
      needsConfirm: false,
      issues: parsed.error.issues.map((i) => ({
        nodeId: typeof i.path[1] === 'string' ? i.path[1] : null,
        code: 'definition',
        message: i.message,
      })),
    }
  }
  const pieces = await storePieces(tx, storeId, plugins)
  const plan = await storePlanId(tx, storeId)
  const issues = pieceIssues(parsed.data, {
    catalogue: pieces.catalogue,
    plan,
    memberPermissions: member.isOwner ? ALL_PERMISSIONS : member.permissions,
    isOwner: member.isOwner,
  })
  if (issues.length > 0) return { ok: false, needsConfirm: false, issues }

  const sensitive = actionIdsOf(parsed.data).some((id) => pieces.catalogue.action(id)?.dangerous)
  if (sensitive && input.confirmName?.trim() !== w.name.trim()) {
    return { ok: false, needsConfirm: true, issues: [] }
  }
  const turnOn = input.turnOn || w.status === 'on'
  if (
    turnOn &&
    w.status !== 'on' &&
    w.origin !== 'growth' &&
    !(await canTurnOnAnother(tx, storeId, plan))
  ) {
    return {
      ok: false,
      needsConfirm: false,
      issues: [
        {
          nodeId: null,
          code: 'plan_limit',
          message: 'Your plan has no room for another active workflow',
        },
      ],
    }
  }

  const [{ n } = { n: 0 }] = await tx
    .select({ n: sql<number>`coalesce(max(${automationVersion.number}), 0)::int` })
    .from(automationVersion)
    .where(eq(automationVersion.workflowId, w.id))
  const [v] = await tx
    .insert(automationVersion)
    .values({
      storeId,
      workflowId: w.id,
      number: n + 1,
      definition: parsed.data,
      publishedBy: member.userId,
    })
    .returning({ id: automationVersion.id })
  const now = new Date()
  await tx
    .update(automationWorkflow)
    .set({
      publishedVersionId: (v as { id: string }).id,
      draftDefinition: null,
      triggerType: parsed.data.trigger.type,
      status: turnOn ? 'on' : 'off',
      problem: null,
      nextFireAt:
        parsed.data.trigger.type === 'schedule'
          ? nextFireAt(parsed.data.trigger.config as ScheduleConfig, now)
          : null,
      updatedAt: now,
    })
    .where(eq(automationWorkflow.id, w.id))
  return { ok: true, version: n + 1, status: turnOn ? 'on' : 'off' }
}

/** Cancels a workflow's open runs (switching off with "cancel", or deleting). */
async function cancelOpenRuns(tx: StoreTx, workflowId: string, now: Date) {
  await tx
    .update(automationRun)
    .set({ status: 'cancelled', stopReason: 'workflow_off', finishedAt: now })
    .where(
      and(
        eq(automationRun.workflowId, workflowId),
        inArray(automationRun.status, [...OPEN_RUN_STATUSES]),
      ),
    )
}

export async function setWorkflowStatus(
  tx: StoreTx,
  storeId: string,
  input: { id: string; status: WorkflowStatus; waitingRuns: 'cancel' | 'finish' },
): Promise<WorkflowDetail> {
  const w = await row(tx, input.id)
  const now = new Date()
  if (input.status === 'on') {
    if (!w.publishedVersionId) throw new WorkflowError('PRECONDITION_FAILED', 'Publish it first')
    if (w.status !== 'on' && w.origin !== 'growth') {
      const plan = await storePlanId(tx, storeId)
      if (!(await canTurnOnAnother(tx, storeId, plan))) {
        throw new WorkflowError(
          'PRECONDITION_FAILED',
          'Your plan has no room for another active workflow',
        )
      }
    }
  } else if (input.waitingRuns === 'cancel') {
    await cancelOpenRuns(tx, w.id, now)
  }
  await tx
    .update(automationWorkflow)
    .set({
      status: input.status,
      ...(input.status === 'on' ? { problem: null } : {}),
      updatedAt: now,
    })
    .where(eq(automationWorkflow.id, w.id))
  return detail(tx, w.id)
}

export async function restoreVersion(
  tx: StoreTx,
  input: { id: string; versionId: string },
): Promise<WorkflowDetail> {
  const [v] = await tx
    .select()
    .from(automationVersion)
    .where(
      and(eq(automationVersion.id, input.versionId), eq(automationVersion.workflowId, input.id)),
    )
  if (!v) throw new WorkflowError('NOT_FOUND', 'Version not found')
  await tx
    .update(automationWorkflow)
    .set({ draftDefinition: v.definition, updatedAt: new Date() })
    .where(eq(automationWorkflow.id, input.id))
  return detail(tx, input.id)
}

export async function duplicateWorkflow(
  tx: StoreTx,
  storeId: string,
  id: string,
  member: Member,
): Promise<WorkflowDetail> {
  const source = await detail(tx, id)
  const [w] = await tx
    .insert(automationWorkflow)
    .values({
      storeId,
      name: `${source.name} (copy)`,
      description: source.description,
      status: 'off',
      origin: 'automations',
      templateId: source.templateId,
      triggerType: source.definition.trigger.type,
      draftDefinition: source.definition,
      createdBy: member.userId,
    })
    .returning({ id: automationWorkflow.id })
  return detail(tx, (w as { id: string }).id)
}

export async function deleteWorkflow(tx: StoreTx, id: string): Promise<{ ok: true }> {
  await row(tx, id)
  // Versions, runs, step runs and record history go with it (foreign keys cascade).
  await tx.delete(automationWorkflow).where(eq(automationWorkflow.id, id))
  return { ok: true }
}

/** Where a workflow came from (Growth's keep marketing permissions); null when missing. */
export async function workflowOrigin(tx: StoreTx, id: string): Promise<WorkflowOrigin | null> {
  const [w] = await tx
    .select({ origin: automationWorkflow.origin })
    .from(automationWorkflow)
    .where(eq(automationWorkflow.id, id))
  return w?.origin ?? null
}
