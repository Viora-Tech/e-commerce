import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * Automations (Shopify Flow equivalent): workflows with immutable published versions, their
 * runs and each step's outcome, which records a run touched, HTTP secrets and monthly usage.
 * Design: docs/superpowers/specs/2026-10-23-automations-app-design.md §8.3. Status words are
 * the ones in @commerce/core/automations `types.ts`; keep the check constraints in step.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const at = (name: string) => timestamp(name, { withTimezone: true })

export type AutomationWorkflowStatus = 'on' | 'off'
export type AutomationWorkflowOrigin = 'automations' | 'growth'

/**
 * A workflow: a trigger plus a tree of steps. Edits go to `draft_definition`; publishing writes
 * an `automation_version` and points `published_version_id` at it. Growth's migrated
 * automations keep their old `marketing_automation.id` as this id (design §10).
 */
export const automationWorkflow = pgTable(
  'automation_workflow',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').$type<AutomationWorkflowStatus>().notNull().default('off'),
    origin: text('origin').$type<AutomationWorkflowOrigin>().notNull().default('automations'),
    /** Template it was created from (`tag-high-value-orders`, Growth's `abandoned_checkout`). */
    templateId: text('template_id'),
    /** Denormalised from the published version, for the trigger lookup. */
    triggerType: text('trigger_type').notNull(),
    publishedVersionId: uuid('published_version_id'),
    /** Unpublished edits (a `WorkflowDefinition`); null when the draft equals the live version. */
    draftDefinition: jsonb('draft_definition').$type<Record<string, unknown>>(),
    /** Scheduled triggers: when the next run is due. */
    nextFireAt: at('next_fire_at'),
    /** Why the engine switched it off (circuit breaker, app removed); null when fine. */
    problem: text('problem'),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('automation_workflow_status', sql`${t.status} in ('on','off')`),
    check('automation_workflow_origin', sql`${t.origin} in ('automations','growth')`),
    index('automation_workflow_trigger').on(t.storeId, t.triggerType, t.status),
    index('automation_workflow_schedule')
      .on(t.nextFireAt)
      .where(sql`${t.status} = 'on' and ${t.nextFireAt} is not null`),
  ],
)

/** A published definition. Never updated: a run pins the version it started on. */
export const automationVersion = pgTable(
  'automation_version',
  {
    id: id(),
    storeId: storeId(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => automationWorkflow.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    publishedBy: text('published_by'),
    publishedAt: at('published_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('automation_version_number').on(t.workflowId, t.number)],
)

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'converted'
  | 'stopped'

/**
 * One trip through a workflow for one subject. `trigger_key` is the idempotency key
 * (`outbox:<rowId>`, `cart:<cartId>`, `manual:<requestId>:<recordId>`, `schedule:<fireAt>`,
 * `app:<pluginId>:<key>`): the same event never starts a workflow twice.
 */
export const automationRun = pgTable(
  'automation_run',
  {
    id: id(),
    storeId: storeId(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => automationWorkflow.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => automationVersion.id, { onDelete: 'cascade' }),
    triggerType: text('trigger_type').notNull(),
    triggerKey: text('trigger_key').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id'),
    status: text('status').$type<AutomationRunStatus>().notNull().default('queued'),
    /** The node to run next; null when finished (or before the first step). */
    cursor: text('cursor'),
    /**
     * Inside a For each: which loop, its records and the pass it is on (`{ node, items, index }`);
     * null outside one. Step rows of a pass carry iteration `index + 1`.
     */
    loop: jsonb('loop').$type<{ node: string; items: { type: string; id: string }[]; index: number }>(),
    nextAt: at('next_at').notNull().defaultNow(),
    /** Automation chain depth of the event that started it (loop guard). */
    depth: integer('depth').notNull().default(0),
    causedByRunId: uuid('caused_by_run_id'),
    /** Started from an order paid on a gateway's test keys (only with `includeTest`). */
    isTest: boolean('is_test').notNull().default(false),
    /** Counted against the plan's monthly runs (false for Growth-origin workflows). */
    metered: boolean('metered').notNull().default(true),
    /** Minimal snapshot of the event: ids plus what conditions need at trigger time. */
    triggerData: jsonb('trigger_data').$type<Record<string, unknown>>().notNull().default({}),
    /** Who asked, for manual runs ("Run automation"). */
    requestedBy: text('requested_by'),
    // Marketing columns, kept from `marketing_automation_run` (design §10).
    customerId: uuid('customer_id'),
    cartId: uuid('cart_id'),
    orderId: uuid('order_id'),
    email: text('email'),
    phone: text('phone'),
    name: text('name'),
    convertedOrderId: uuid('converted_order_id'),
    /** Why it was skipped or stopped (`RunReason`), or the failing step's error. */
    stopReason: text('stop_reason'),
    error: text('error'),
    startedAt: at('started_at').notNull().defaultNow(),
    finishedAt: at('finished_at'),
  },
  (t) => [
    check(
      'automation_run_status',
      sql`${t.status} in ('queued','running','waiting','awaiting_approval','completed','failed','cancelled','skipped','converted','stopped')`,
    ),
    uniqueIndex('automation_run_trigger').on(t.workflowId, t.triggerKey),
    index('automation_run_due').on(t.storeId, t.status, t.nextAt),
    index('automation_run_subject').on(t.storeId, t.subjectType, t.subjectId, t.startedAt),
    index('automation_run_workflow').on(t.workflowId, t.startedAt),
    index('automation_run_store_started').on(t.storeId, t.startedAt),
  ],
)

export type AutomationStepRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'then'
  | 'otherwise'
  | 'waiting'
  | 'awaiting_approval'
  | 'cancelled'

/**
 * One node's outcome in one run. Unique per (run, node, iteration): a re-executed step finds
 * its row, so an internal action's effect and this row commit together exactly once. Approval
 * state for "Ask before running" lives here too (design §8.7).
 */
export const automationStepRun = pgTable(
  'automation_step_run',
  {
    id: id(),
    storeId: storeId(),
    runId: uuid('run_id')
      .notNull()
      .references(() => automationRun.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    /** 0 for now; reserved for For each. */
    iteration: integer('iteration').notNull().default(0),
    /** The node kind and action id, so the log reads without the version. */
    kind: text('kind').notNull(),
    actionId: text('action_id'),
    attempt: integer('attempt').notNull().default(1),
    status: text('status').$type<AutomationStepRunStatus>().notNull().default('running'),
    /** Resolved config (secrets redacted). */
    input: jsonb('input').$type<Record<string, unknown>>(),
    /** What it did (≤ 8 KB), the condition trace, or the approval preview. */
    output: jsonb('output').$type<Record<string, unknown>>(),
    summary: text('summary'),
    error: text('error'),
    /** Retryable failure: when the step job tries again. */
    retryAt: at('retry_at'),
    approvalExpiresAt: at('approval_expires_at'),
    decidedBy: text('decided_by'),
    decidedAt: at('decided_at'),
    startedAt: at('started_at').notNull().defaultNow(),
    finishedAt: at('finished_at'),
  },
  (t) => [
    check(
      'automation_step_run_status',
      sql`${t.status} in ('running','succeeded','failed','skipped','then','otherwise','waiting','awaiting_approval','cancelled')`,
    ),
    uniqueIndex('automation_step_run_node').on(t.runId, t.nodeId, t.iteration),
    index('automation_step_run_approval')
      .on(t.storeId, t.approvalExpiresAt)
      .where(sql`${t.status} = 'awaiting_approval'`),
    index('automation_step_run_store_started').on(t.storeId, t.startedAt),
  ],
)

/** Records a run is about or changed, for "Automations on this record". */
export const automationRunRecord = pgTable(
  'automation_run_record',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => automationRun.id, { onDelete: 'cascade' }),
    storeId: storeId(),
    recordType: text('record_type').notNull(),
    recordId: uuid('record_id').notNull(),
    role: text('role').$type<'subject' | 'changed'>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.runId, t.recordType, t.recordId] }),
    check('automation_run_record_role', sql`${t.role} in ('subject','changed')`),
    index('automation_run_record_lookup').on(t.storeId, t.recordType, t.recordId, t.createdAt),
  ],
)

/** A store secret for the HTTP action (`{{secrets.handle}}`), encrypted with SETTINGS_SECRET. */
export const automationSecret = pgTable(
  'automation_secret',
  {
    id: id(),
    storeId: storeId(),
    handle: text('handle').notNull(),
    /** Encrypted with the settings secret (same helper as phone crypto); never sent to clients. */
    valueEncrypted: text('value_encrypted').notNull(),
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('automation_secret_handle').on(t.storeId, t.handle)],
)

/** Metered runs per store per calendar month in India (`YYYY-MM`), like `ai_usage`. */
export const automationUsage = pgTable(
  'automation_usage',
  {
    storeId: storeId(),
    month: text('month').notNull(),
    runs: integer('runs').notNull().default(0),
    /** Owner emailed at 80% / 100% this month (once each). */
    warnedAt80: at('warned_at_80'),
    warnedAt100: at('warned_at_100'),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.month] })],
)
