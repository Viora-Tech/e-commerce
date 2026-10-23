/** SOURCE OF TRUTH: Growth → Automations persistence — WHAT: the list, detail, create, edit, on/off and delete behind Growth → Automations, reading and writing the legacy `marketing_automation` tables for legacy stores and `automation_workflow` rows (`origin='growth'`) for stores cut over to the engine, in the same shape either way / WHY: design §9.4: Growth keeps its list, stats and linear editor while the engine runs the automations; the router and the admin never branch on the store's runner. Server-only. */
import {
  automationRun,
  automationVersion,
  automationWorkflow,
  marketingMessage,
  type StoreTx,
} from '@commerce/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { type Rule, WorkflowDefinitionSchema, walkNodes } from '../automations/definition'
import { isOpenRunStatus, type RunStatus } from '../automations/types'
import { CommerceError } from '../errors'
import { automationsEngineMode } from './automation-cutover'
import {
  ENGINE_TRIGGER,
  mapAutomation,
  SEND_EMAIL_ACTION,
  SEND_WHATSAPP_ACTION,
} from './automation-engine-map'
import {
  type AutomationSettings,
  type AutomationStep,
  type AutomationTrigger,
  automationTemplate,
  type CONDITION_FIELDS,
  parseAutomationSteps,
} from './automation-steps'
import {
  type AutomationInput,
  type AutomationRow,
  type AutomationStats,
  automationStats,
  createAutomationFromTemplate,
  deleteAutomation,
  getAutomation,
  listAutomations,
  recentRuns,
  setAutomationStatus,
  updateAutomation,
} from './automations'

/** A Growth automation as the admin reads it, whichever runner owns the store. */
export type GrowthAutomation = AutomationRow & {
  /** False when the workflow branches or uses non-marketing actions (edit it in Automations). */
  editable: boolean
  /** The store runs it on the Automations engine. */
  engine: boolean
}

export type GrowthRun = Awaited<ReturnType<typeof recentRuns>>[number]

/** Thrown when Growth's linear editor saves a workflow it can only show. */
export class GrowthAutomationNotEditable extends CommerceError {
  constructor() {
    super(
      'GROWTH_AUTOMATION_NOT_EDITABLE',
      'This automation has branches or other actions: edit it in Automations',
    )
  }
}

const LEGACY_TRIGGER = Object.fromEntries(
  Object.entries(ENGINE_TRIGGER).map(([legacy, engine]) => [engine, legacy]),
) as Record<string, AutomationTrigger>

type WorkflowRow = typeof automationWorkflow.$inferSelect

// ---------------------------------------------------------------------------
// Engine definition → Growth's linear steps

const FIELD_OF: Record<string, (typeof CONDITION_FIELDS)[number]> = {
  total: 'cart_value',
  order_count: 'order_count',
  has_ordered: 'has_ordered',
  accepts_marketing: 'accepts_marketing',
}

function conditionStep(id: string, rule: Rule): AutomationStep | null {
  const leaf = rule.field.split('.').at(-1) ?? ''
  const field = FIELD_OF[leaf]
  if (!field) return null
  if (rule.op === 'is_true' || rule.op === 'is_false') {
    return { id, type: 'condition', field, op: 'eq', value: String(rule.op === 'is_true') }
  }
  if (rule.op !== 'gte' && rule.op !== 'lte' && rule.op !== 'eq') return null
  if (typeof rule.value !== 'number') return null
  const value = field === 'cart_value' ? String(rule.value / 100) : String(rule.value)
  return { id, type: 'condition', field, op: rule.op, value }
}

/**
 * The definition as Growth's linear steps, or null when it is not a straight line of waits,
 * marketing messages and "continue only if" conditions (then Growth shows it read-only).
 */
export function stepsFromDefinition(raw: unknown): AutomationStep[] | null {
  const parsed = WorkflowDefinitionSchema.safeParse(raw)
  if (!parsed.success) return null
  const steps: AutomationStep[] = []
  for (const node of walkNodes(parsed.data)) {
    if (node.kind === 'wait') {
      steps.push({ id: node.id, type: 'wait', minutes: node.minutes })
    } else if (node.kind === 'action') {
      const c = node.config as Record<string, unknown>
      if (node.action === SEND_EMAIL_ACTION) {
        steps.push({
          id: node.id,
          type: 'email',
          subject: String(c.subject ?? ''),
          previewText: String(c.previewText ?? ''),
          blocks: (c.blocks ?? []) as Extract<AutomationStep, { type: 'email' }>['blocks'],
        })
      } else if (node.action === SEND_WHATSAPP_ACTION) {
        steps.push({
          id: node.id,
          type: 'whatsapp',
          template: c.template as Extract<AutomationStep, { type: 'whatsapp' }>['template'],
        })
      } else return null
    } else if (node.kind === 'condition') {
      const [rule, ...rest] = node.rules.rules
      if (node.otherwise !== null || rest.length > 0 || !rule || 'join' in rule) return null
      const step = conditionStep(node.id, rule)
      if (!step) return null
      steps.push(step)
    } else return null
  }
  return steps
}

function settingsFromConfig(config: Record<string, unknown>): AutomationSettings {
  const out: AutomationSettings = {}
  if (typeof config.afterMinutes === 'number') out.afterMinutes = config.afterMinutes
  if (typeof config.lapsedDays === 'number') out.lapsedDays = config.lapsedDays
  return out
}

async function liveDefinition(tx: StoreTx, w: WorkflowRow): Promise<unknown> {
  if (!w.publishedVersionId) return w.draftDefinition
  const [v] = await tx
    .select({ definition: automationVersion.definition })
    .from(automationVersion)
    .where(eq(automationVersion.id, w.publishedVersionId))
  return v?.definition ?? w.draftDefinition
}

async function toGrowth(tx: StoreTx, w: WorkflowRow): Promise<GrowthAutomation> {
  const def = (await liveDefinition(tx, w)) as {
    trigger?: { config?: Record<string, unknown> }
  } | null
  const steps = stepsFromDefinition(def)
  return {
    id: w.id,
    storeId: w.storeId,
    template: w.templateId ?? '',
    trigger: LEGACY_TRIGGER[w.triggerType] ?? w.triggerType,
    name: w.name,
    status: w.status === 'on' ? 'active' : 'paused',
    steps: steps ?? [],
    settings: settingsFromConfig(def?.trigger?.config ?? {}),
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    editable: steps !== null,
    engine: true,
  }
}

// ---------------------------------------------------------------------------
// Engine stats and runs

const EMPTY: AutomationStats = {
  runs: 0,
  active: 0,
  converted: 0,
  sent: 0,
  opened: 0,
  clicked: 0,
  orders: 0,
  revenuePaise: 0,
}

/** `automationStats` on the engine tables: runs by workflow, messages through their run. */
export async function engineAutomationStats(
  tx: StoreTx,
  ids: string[],
): Promise<Map<string, AutomationStats>> {
  const out = new Map<string, AutomationStats>(ids.map((id) => [id, { ...EMPTY }]))
  if (ids.length === 0) return out
  const runs = await tx
    .select({
      id: automationRun.workflowId,
      runs: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${automationRun.status} in ('queued','running','waiting','awaiting_approval'))::int`,
      converted: sql<number>`count(*) filter (where ${automationRun.status} = 'converted')::int`,
      revenue: sql<number>`coalesce(sum(o.total_paise) filter (where ${automationRun.status} = 'converted' and not o.is_test), 0)::int`,
    })
    .from(automationRun)
    .leftJoin(sql`"order" o`, sql`o.id = ${automationRun.convertedOrderId}`)
    .where(inArray(automationRun.workflowId, ids))
    .groupBy(automationRun.workflowId)
  const messages = await tx
    .select({
      id: automationRun.workflowId,
      sent: sql<number>`count(*) filter (where ${marketingMessage.status} = 'sent')::int`,
      opened: sql<number>`count(${marketingMessage.openedAt})::int`,
      clicked: sql<number>`count(${marketingMessage.clickedAt})::int`,
    })
    .from(marketingMessage)
    .innerJoin(automationRun, eq(automationRun.id, marketingMessage.automationRunId))
    .where(inArray(automationRun.workflowId, ids))
    .groupBy(automationRun.workflowId)
  for (const r of runs) {
    const s = out.get(r.id)
    if (s)
      Object.assign(s, {
        runs: r.runs,
        active: r.active,
        converted: r.converted,
        orders: r.converted,
        revenuePaise: r.revenue,
      })
  }
  for (const m of messages) {
    const s = out.get(m.id)
    if (s) Object.assign(s, { sent: m.sent, opened: m.opened, clicked: m.clicked })
  }
  return out
}

/** Growth's run row words: open runs are `active`; failed, cancelled and skipped ones stopped. */
function legacyStatus(s: RunStatus): GrowthRun['status'] {
  if (isOpenRunStatus(s)) return 'active'
  if (s === 'completed' || s === 'converted') return s
  return 'stopped'
}

async function engineRecentRuns(
  tx: StoreTx,
  workflowId: string,
  steps: AutomationStep[],
  limit = 20,
): Promise<GrowthRun[]> {
  const rows = await tx
    .select()
    .from(automationRun)
    .where(eq(automationRun.workflowId, workflowId))
    .orderBy(desc(automationRun.startedAt))
    .limit(limit)
  return rows.map((r) => {
    const at = r.cursor ? steps.findIndex((s) => s.id === r.cursor) : -1
    return {
      id: r.id,
      email: r.email,
      phone: r.phone,
      name: r.name,
      status: legacyStatus(r.status),
      stepIndex: at >= 0 ? at : steps.length,
      nextAt: r.nextAt,
      stopReason: r.stopReason ?? (r.status === 'failed' ? r.error : null),
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    }
  })
}

// ---------------------------------------------------------------------------
// Engine writes

async function growthWorkflow(tx: StoreTx, id: string): Promise<WorkflowRow | null> {
  const [w] = await tx
    .select()
    .from(automationWorkflow)
    .where(and(eq(automationWorkflow.id, id), eq(automationWorkflow.origin, 'growth')))
  return w ?? null
}

/** Writes the steps as the next immutable version and points the workflow at it. */
async function publishSteps(
  tx: StoreTx,
  w: Pick<WorkflowRow, 'id' | 'storeId' | 'templateId' | 'name' | 'status'>,
  trigger: AutomationTrigger,
  input: { steps: AutomationStep[]; settings: AutomationSettings },
  memberId: string | null,
): Promise<void> {
  const mapped = mapAutomation({
    id: w.id,
    template: w.templateId ?? '',
    trigger,
    name: w.name,
    status: w.status === 'on' ? 'active' : 'paused',
    steps: input.steps,
    settings: input.settings,
  })
  if (!mapped) throw new Error(`Unknown automation trigger ${trigger}`)
  const [last] = await tx
    .select({ n: sql<number>`coalesce(max(${automationVersion.number}), 0)::int` })
    .from(automationVersion)
    .where(eq(automationVersion.workflowId, w.id))
  const [v] = await tx
    .insert(automationVersion)
    .values({
      storeId: w.storeId,
      workflowId: w.id,
      number: (last?.n ?? 0) + 1,
      definition: mapped.definition as unknown as Record<string, unknown>,
      publishedBy: memberId,
    })
    .returning({ id: automationVersion.id })
  await tx
    .update(automationWorkflow)
    .set({
      publishedVersionId: v?.id ?? null,
      draftDefinition: null,
      triggerType: mapped.triggerType,
      updatedAt: new Date(),
    })
    .where(eq(automationWorkflow.id, w.id))
}

// ---------------------------------------------------------------------------
// The Growth API, whichever runner owns the store

export type GrowthAutomationListItem = GrowthAutomation & { stats: AutomationStats }

export async function listGrowthAutomations(
  tx: StoreTx,
  storeId: string,
): Promise<GrowthAutomationListItem[]> {
  if ((await automationsEngineMode(tx, storeId)) === 'legacy') {
    return (await listAutomations(tx)).map((a) => ({ ...a, editable: true, engine: false }))
  }
  const rows = await tx
    .select()
    .from(automationWorkflow)
    .where(eq(automationWorkflow.origin, 'growth'))
    .orderBy(desc(automationWorkflow.createdAt))
  const stats = await engineAutomationStats(
    tx,
    rows.map((r) => r.id),
  )
  return Promise.all(
    rows.map(async (r) => ({
      ...(await toGrowth(tx, r)),
      stats: stats.get(r.id) ?? { ...EMPTY },
    })),
  )
}

export async function getGrowthAutomation(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<(GrowthAutomationListItem & { runs: GrowthRun[] }) | null> {
  if ((await automationsEngineMode(tx, storeId)) === 'legacy') {
    const a = await getAutomation(tx, id)
    if (!a) return null
    const [stats, runs] = await Promise.all([automationStats(tx, [a.id]), recentRuns(tx, a.id)])
    return {
      ...a,
      editable: true,
      engine: false,
      stats: stats.get(a.id) ?? { ...EMPTY },
      runs,
    }
  }
  const w = await growthWorkflow(tx, id)
  if (!w) return null
  const g = await toGrowth(tx, w)
  const [stats, runs] = await Promise.all([
    engineAutomationStats(tx, [w.id]),
    engineRecentRuns(tx, w.id, parseAutomationSteps(g.steps)),
  ])
  return { ...g, stats: stats.get(w.id) ?? { ...EMPTY }, runs }
}

export async function createGrowthAutomation(
  tx: StoreTx,
  storeId: string,
  templateId: string,
  memberId: string | null = null,
): Promise<GrowthAutomation | null> {
  if ((await automationsEngineMode(tx, storeId)) === 'legacy') {
    const row = await createAutomationFromTemplate(tx, storeId, templateId)
    return row ? { ...row, editable: true, engine: false } : null
  }
  const t = automationTemplate(templateId)
  if (!t) return null
  const [w] = await tx
    .insert(automationWorkflow)
    .values({
      storeId,
      name: t.name,
      status: 'off',
      origin: 'growth',
      templateId: t.id,
      triggerType: ENGINE_TRIGGER[t.trigger],
      createdBy: memberId,
    })
    .returning()
  if (!w) return null
  await publishSteps(tx, w, t.trigger, { steps: t.steps, settings: t.settings }, memberId)
  return toGrowth(tx, (await growthWorkflow(tx, w.id)) as WorkflowRow)
}

export async function updateGrowthAutomation(
  tx: StoreTx,
  storeId: string,
  id: string,
  input: AutomationInput,
  memberId: string | null = null,
): Promise<GrowthAutomation | null> {
  if ((await automationsEngineMode(tx, storeId)) === 'legacy') {
    const row = await updateAutomation(tx, id, input)
    return row ? { ...row, editable: true, engine: false } : null
  }
  const w = await growthWorkflow(tx, id)
  if (!w) return null
  const current = await toGrowth(tx, w)
  if (!current.editable) throw new GrowthAutomationNotEditable()
  await tx.update(automationWorkflow).set({ name: input.name }).where(eq(automationWorkflow.id, id))
  await publishSteps(
    tx,
    { ...w, name: input.name },
    current.trigger as AutomationTrigger,
    input,
    memberId,
  )
  return toGrowth(tx, (await growthWorkflow(tx, id)) as WorkflowRow)
}

/**
 * Pausing holds every run where it is, as Growth always did: on the engine an Off growth
 * workflow's waiting runs stay parked until it is switched back on.
 */
export async function setGrowthAutomationStatus(
  tx: StoreTx,
  storeId: string,
  id: string,
  status: 'active' | 'paused',
): Promise<GrowthAutomation | null> {
  if ((await automationsEngineMode(tx, storeId)) === 'legacy') {
    const row = await setAutomationStatus(tx, id, status)
    return row ? { ...row, editable: true, engine: false } : null
  }
  const [w] = await tx
    .update(automationWorkflow)
    .set({ status: status === 'active' ? 'on' : 'off', problem: null, updatedAt: new Date() })
    .where(and(eq(automationWorkflow.id, id), eq(automationWorkflow.origin, 'growth')))
    .returning()
  return w ? toGrowth(tx, w) : null
}

export async function deleteGrowthAutomation(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<void> {
  if ((await automationsEngineMode(tx, storeId)) === 'legacy') {
    await deleteAutomation(tx, id)
    return
  }
  await tx
    .delete(automationWorkflow)
    .where(and(eq(automationWorkflow.id, id), eq(automationWorkflow.origin, 'growth')))
}
