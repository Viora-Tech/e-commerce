/** SOURCE OF TRUTH: automation trigger matching — WHAT: turns an event (outbox row, sweep hit, schedule fire, manual request, plugin trigger) into idempotent `automation_run` rows for every On workflow listening to it, applying the trigger filters (imported and test orders, COD / first order, loop guard, dedupe, circuit breaker, plan metering) / WHY: one path creates runs, so `(workflow_id, trigger_key)` is the only idempotency rule and every skip is logged the same way. Conditions are not evaluated here: they run as nodes so the run log shows why (design §8.5). */
import {
  automationRun,
  automationRunRecord,
  automationVersion,
  automationWorkflow,
  order,
  outboxEvent,
  type StoreTx,
} from '@commerce/db'
import { and, eq, gte, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { OutboxEventType, OutboxPayload } from '../../outbox/types'
import { BUILTIN_TRIGGERS } from '../builtin-triggers'
import { type WorkflowDefinition, WorkflowDefinitionSchema } from '../definition'
import type { RunSubject } from '../executor'
import {
  type AutomationCause,
  MAX_AUTOMATION_DEPTH,
  MAX_RUNS_PER_SUBJECT_HOUR,
  type RunReason,
} from '../types'
import { meterRun, storePlanId } from './usage'

/** One thing that happened, ready to start runs. */
export type TriggerEvent = {
  /** Trigger ids that listen to it (`order.paid`, `order.cod_placed`, `meta/lead_received`). */
  triggerIds: readonly string[]
  /** Idempotency key, unique per event per workflow (`outbox:<rowId>`, `cart:<id>`…). */
  key: string
  subject: RunSubject
  /** Minimal snapshot for `automation_run.trigger_data`. */
  data: Record<string, unknown>
  /** Set when an automation's own action caused the event. */
  cause: AutomationCause | null
  /** Member who asked ("Run automation"). */
  requestedBy?: string | undefined
  /** Marketing columns, when the source knows them (sweeps). */
  contact?:
    | {
        customerId?: string | null | undefined
        cartId?: string | null | undefined
        orderId?: string | null | undefined
        email?: string | null | undefined
        phone?: string | null | undefined
        name?: string | null | undefined
      }
    | undefined
  /** Only these workflows (manual runs pick one). */
  workflowIds?: readonly string[] | undefined
}

export type StartedRun = { runId: string; workflowId: string; nextAt: Date }
export type StartOutcome = {
  started: StartedRun[]
  skipped: { workflowId: string; reason: RunReason }[]
}

const NONE: StartOutcome = { started: [], skipped: [] }

/** Trigger ids that listen to an outbox type, from the built-in catalogue. */
function triggersForOutboxType(type: string): string[] {
  return BUILTIN_TRIGGERS.filter((t) => t.outboxTypes?.includes(type)).map((t) => t.id)
}

/** Outbox types any automation trigger listens to (the relay enqueues only these). */
export const AUTOMATION_OUTBOX_TYPES: ReadonlySet<string> = new Set([
  ...BUILTIN_TRIGGERS.flatMap((t) => t.outboxTypes ?? []),
  'automation.app_trigger',
])

/** What an outbox row is about. */
function subjectForOutbox(type: OutboxEventType, payload: OutboxPayload): RunSubject | null {
  if (type === 'automation.app_trigger') {
    const s = payload.appTrigger?.subject
    return s ? { type: s.type, id: s.id } : { type: 'none', id: null }
  }
  if (type.startsWith('customer.')) {
    return payload.customerId ? { type: 'customer', id: payload.customerId } : null
  }
  if (type.startsWith('product.') || type === 'inventory.low' || type === 'inventory.out') {
    return payload.productId ? { type: 'product', id: payload.productId } : null
  }
  return payload.orderId ? { type: 'order', id: payload.orderId } : null
}

/** The event an outbox row becomes. Null when nothing could listen to it. */
export function eventForOutbox(row: {
  id: string
  type: string
  payload: unknown
}): TriggerEvent | null {
  const type = row.type as OutboxEventType
  const payload = (row.payload ?? {}) as OutboxPayload
  if (!AUTOMATION_OUTBOX_TYPES.has(type)) return null
  const subject = subjectForOutbox(type, payload)
  if (!subject) return null
  const triggerIds =
    type === 'automation.app_trigger'
      ? payload.appTrigger?.trigger
        ? [payload.appTrigger.trigger]
        : []
      : triggersForOutboxType(type)
  if (triggerIds.length === 0) return null
  const pluginKey =
    type === 'automation.app_trigger' && payload.appTrigger
      ? `app:${payload.appTrigger.trigger.split('/')[0]}:${payload.appTrigger.key}`
      : null
  const { automation, custom: _custom, ...ids } = payload
  return {
    triggerIds,
    key: pluginKey ?? `outbox:${row.id}`,
    subject,
    data: { event: type, ...ids },
    cause: automation ?? null,
  }
}

type OrderFacts = {
  id: string
  importedFrom: string | null
  isTest: boolean
  paymentMethod: string | null
  customerId: string | null
  email: string | null
  phone: string | null
  status: string
}

async function orderFacts(tx: StoreTx, id: string): Promise<OrderFacts | null> {
  const [o] = await tx
    .select({
      id: order.id,
      importedFrom: order.importedFrom,
      isTest: order.isTest,
      paymentMethod: order.paymentMethod,
      customerId: order.customerId,
      email: order.email,
      phone: order.phone,
      status: order.status,
    })
    .from(order)
    .where(eq(order.id, id))
  return o ?? null
}

async function isFirstOrder(tx: StoreTx, o: OrderFacts): Promise<boolean> {
  if (!o.customerId) return false
  const [{ n } = { n: 0 }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(
      and(
        eq(order.customerId, o.customerId),
        sql`${order.status} not in ('draft', 'cancelled')`,
        isNull(order.importedFrom),
      ),
    )
  return n === 1
}

/** Per trigger: does the event really match, and which key does the run take. */
async function matchOrderTrigger(
  tx: StoreTx,
  triggerType: string,
  o: OrderFacts,
): Promise<{ match: boolean; key?: string }> {
  // Growth's enrolment keyed these by order (`order:<id>`); the same key keeps a run started
  // before the cut-over from starting again after it.
  if (triggerType === 'order.cod_placed') {
    return { match: o.paymentMethod === 'cod', key: `order:${o.id}` }
  }
  if (triggerType === 'customer.first_order') {
    return { match: await isFirstOrder(tx, o), key: `order:${o.id}` }
  }
  return { match: true }
}

type Candidate = {
  id: string
  origin: 'automations' | 'growth'
  triggerType: string
  versionId: string
  definition: WorkflowDefinition
}

async function candidates(tx: StoreTx, storeId: string, ev: TriggerEvent): Promise<Candidate[]> {
  const rows = await tx
    .select({
      id: automationWorkflow.id,
      origin: automationWorkflow.origin,
      triggerType: automationWorkflow.triggerType,
      versionId: automationVersion.id,
      definition: automationVersion.definition,
    })
    .from(automationWorkflow)
    .innerJoin(automationVersion, eq(automationVersion.id, automationWorkflow.publishedVersionId))
    .where(
      and(
        eq(automationWorkflow.storeId, storeId),
        eq(automationWorkflow.status, 'on'),
        inArray(automationWorkflow.triggerType, [...ev.triggerIds]),
        isNotNull(automationWorkflow.publishedVersionId),
        ...(ev.workflowIds ? [inArray(automationWorkflow.id, [...ev.workflowIds])] : []),
      ),
    )
  const out: Candidate[] = []
  for (const r of rows) {
    const parsed = WorkflowDefinitionSchema.safeParse(r.definition)
    if (parsed.success) out.push({ ...r, definition: parsed.data })
  }
  return out
}

/** Runs of this workflow on this subject in the last `minutes`, skipped ones left out. */
async function recentRunCount(
  tx: StoreTx,
  workflowId: string,
  subject: RunSubject,
  since: Date,
): Promise<number> {
  if (!subject.id) return 0
  const [{ n } = { n: 0 }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(automationRun)
    .where(
      and(
        eq(automationRun.workflowId, workflowId),
        eq(automationRun.subjectType, subject.type),
        eq(automationRun.subjectId, subject.id),
        gte(automationRun.startedAt, since),
        ne(automationRun.status, 'skipped'),
      ),
    )
  return n
}

/** Switches a workflow off with a reason the merchant sees (circuit breaker, app removed). */
export async function switchOffWithProblem(tx: StoreTx, workflowId: string, problem: string) {
  await tx
    .update(automationWorkflow)
    .set({ status: 'off', problem, updatedAt: new Date() })
    .where(eq(automationWorkflow.id, workflowId))
}

/**
 * Starts runs for one event. Idempotent: the same event (same key) never starts a workflow
 * twice, so a re-delivered outbox row or a double-clicked "Run automation" is a no-op.
 * Returns the queued runs for the caller to enqueue after commit.
 */
export async function startRuns(
  tx: StoreTx,
  storeId: string,
  ev: TriggerEvent,
  now = new Date(),
): Promise<StartOutcome> {
  const workflows = await candidates(tx, storeId, ev)
  if (workflows.length === 0) return NONE

  const o =
    ev.subject.type === 'order' && ev.subject.id ? await orderFacts(tx, ev.subject.id) : null
  if (ev.subject.type === 'order' && !o) return NONE
  // Imported orders never start automations (Growth's rule, design §4); a member's explicit
  // "Run automation" may still run on one.
  const manual = ev.requestedBy !== undefined
  if (!manual && (o?.importedFrom || o?.status === 'draft')) return NONE

  const out: StartOutcome = { started: [], skipped: [] }
  let plan: Awaited<ReturnType<typeof storePlanId>> | null = null

  for (const wf of workflows) {
    const config = wf.definition.trigger.config as { includeTest?: boolean }
    if (o?.isTest && !config.includeTest && !manual) continue
    let key = ev.key
    if (o) {
      const m = await matchOrderTrigger(tx, wf.triggerType, o)
      if (!m.match) continue
      if (m.key) key = m.key
    }
    // Growth enrols a customer in its welcome series once per workflow, ever: however often they
    // subscribe again, the key stays the same.
    if (wf.triggerType === 'customer.subscribed' && ev.subject.id)
      key = `subscribed:${ev.subject.id}`

    let reason: RunReason | null = null
    if (ev.cause && ev.cause.depth >= MAX_AUTOMATION_DEPTH) reason = 'loop_depth'
    else if (ev.cause?.workflowId === wf.id) reason = 'own_event'
    if (!reason && wf.definition.settings.dedupeMinutes) {
      const since = new Date(now.getTime() - wf.definition.settings.dedupeMinutes * 60_000)
      if ((await recentRunCount(tx, wf.id, ev.subject, since)) > 0) reason = 'dedupe'
    }
    if (!reason) {
      const hourAgo = new Date(now.getTime() - 60 * 60_000)
      if ((await recentRunCount(tx, wf.id, ev.subject, hourAgo)) >= MAX_RUNS_PER_SUBJECT_HOUR) {
        reason = 'circuit_breaker'
        await switchOffWithProblem(
          tx,
          wf.id,
          `Switched off: it ran more than ${MAX_RUNS_PER_SUBJECT_HOUR} times in an hour on one record`,
        )
      }
    }

    const contact = ev.contact ?? {}
    const [row] = await tx
      .insert(automationRun)
      .values({
        storeId,
        workflowId: wf.id,
        versionId: wf.versionId,
        triggerType: wf.triggerType,
        triggerKey: key,
        subjectType: ev.subject.type,
        subjectId: ev.subject.id,
        status: reason ? 'skipped' : 'queued',
        cursor: wf.definition.start,
        nextAt: now,
        depth: ev.cause ? ev.cause.depth : 0,
        causedByRunId: ev.cause?.runId ?? null,
        isTest: o?.isTest ?? false,
        metered: wf.origin !== 'growth',
        triggerData: ev.data,
        requestedBy: ev.requestedBy ?? null,
        customerId: contact.customerId ?? o?.customerId ?? null,
        cartId: contact.cartId ?? null,
        orderId: contact.orderId ?? o?.id ?? null,
        email: contact.email ?? o?.email ?? null,
        phone: contact.phone ?? null,
        name: contact.name ?? null,
        stopReason: reason,
        startedAt: now,
        finishedAt: reason ? now : null,
      })
      .onConflictDoNothing({ target: [automationRun.workflowId, automationRun.triggerKey] })
      .returning({ id: automationRun.id })
    if (!row) continue

    if (ev.subject.id) {
      await tx
        .insert(automationRunRecord)
        .values({
          runId: row.id,
          storeId,
          recordType: ev.subject.type,
          recordId: ev.subject.id,
          role: 'subject',
        })
        .onConflictDoNothing()
    }
    if (reason) {
      out.skipped.push({ workflowId: wf.id, reason })
      continue
    }

    // Growth's marketing workflows are never metered or skipped (design §8.5).
    if (wf.origin !== 'growth') {
      plan ??= await storePlanId(tx, storeId, now)
      const meter = await meterRun(tx, storeId, plan, now)
      if (!meter.ok) {
        await tx
          .update(automationRun)
          .set({ status: 'skipped', stopReason: 'plan_limit', finishedAt: now })
          .where(eq(automationRun.id, row.id))
        out.skipped.push({ workflowId: wf.id, reason: 'plan_limit' })
        continue
      }
    }
    out.started.push({ runId: row.id, workflowId: wf.id, nextAt: now })
  }
  return out
}

/** The trigger job: the outbox row's event, turned into runs. A missing row starts nothing. */
export async function startRunsForOutboxRow(
  tx: StoreTx,
  storeId: string,
  outboxId: string,
  now = new Date(),
): Promise<StartOutcome> {
  const [row] = await tx
    .select({ id: outboxEvent.id, type: outboxEvent.type, payload: outboxEvent.payload })
    .from(outboxEvent)
    .where(eq(outboxEvent.id, outboxId))
  const ev = row ? eventForOutbox(row) : null
  return ev ? startRuns(tx, storeId, ev, now) : NONE
}
