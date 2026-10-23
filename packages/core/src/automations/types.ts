/** SOURCE OF TRUTH: automation run statuses and shared ids — WHAT: workflow, run and step-run statuses, subject types, risk classes and plan tiers of the Automations engine / WHY: the DB check constraints, the worker, the API and the admin's status chips must read the same words. Pure, client-safe (`@commerce/core/automations`). Design: docs/superpowers/specs/2026-10-23-automations-app-design.md §8. */

/** On: new events start runs. Off: nothing new starts (waiting runs may finish, see `pause`). */
export const WORKFLOW_STATUSES = ['on', 'off'] as const
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]

/** `growth`: one of Growth's marketing automations (marketing.* permissions, never metered). */
export const WORKFLOW_ORIGINS = ['automations', 'growth'] as const
export type WorkflowOrigin = (typeof WORKFLOW_ORIGINS)[number]

/** What a run is about. Plugin triggers may add their own type (`<pluginId>/<name>`). */
export const BUILTIN_SUBJECT_TYPES = ['order', 'customer', 'product', 'cart', 'none'] as const
export type BuiltinSubjectType = (typeof BUILTIN_SUBJECT_TYPES)[number]
export type SubjectType = BuiltinSubjectType | (string & {})

/**
 * - `queued`: created, its step job not yet picked up.
 * - `running`: a step job holds it.
 * - `waiting`: parked on a wait node until `next_at`.
 * - `awaiting_approval`: parked on an action that asks before running.
 * - `completed`: reached the end of a branch.
 * - `failed`: an action failed with `onError: 'stop'` (or retries ran out).
 * - `cancelled`: a member cancelled it, or the workflow was switched off with "cancel waiting".
 * - `skipped`: never ran (plan limit, loop guard, dedupe); `error` says why.
 * - `converted`: marketing exit, the customer placed an order (`exitOnOrder`).
 * - `stopped`: ended early on purpose (a condition said stop, unsubscribed, recipient changed).
 */
export const RUN_STATUSES = [
  'queued',
  'running',
  'waiting',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
  'skipped',
  'converted',
  'stopped',
] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

/** Runs that can still move. */
export const OPEN_RUN_STATUSES: readonly RunStatus[] = [
  'queued',
  'running',
  'waiting',
  'awaiting_approval',
]

export const isOpenRunStatus = (s: RunStatus): boolean => OPEN_RUN_STATUSES.includes(s)

/**
 * One node's outcome in one run. Conditions record `then` / `otherwise` (the branch taken);
 * actions `succeeded` / `failed` / `skipped`; waits `waiting` then `succeeded`.
 */
export const STEP_RUN_STATUSES = [
  'running',
  'succeeded',
  'failed',
  'skipped',
  'then',
  'otherwise',
  'waiting',
  'awaiting_approval',
  'cancelled',
] as const
export type StepRunStatus = (typeof STEP_RUN_STATUSES)[number]

/**
 * - `safe`: tags, notes, metafields, collections, staff alerts, hold/release.
 * - `customer`: messages the shopper (badged "Messages customers").
 * - `sensitive`: cancel, fulfil, HTTP (data leaves the platform). Typed confirm at publish.
 */
export const ACTION_RISKS = ['safe', 'customer', 'sensitive'] as const
export type ActionRisk = (typeof ACTION_RISKS)[number]

/** Lowest plan a piece is available on (owner, 2026-10-23: HTTP and plugin actions Growth+). */
export type AutomationPlanTier = 'starter' | 'growth' | 'pro'

/** Where a trigger's events come from. */
export const TRIGGER_SOURCES = ['outbox', 'sweep', 'schedule', 'manual', 'plugin'] as const
export type TriggerSource = (typeof TRIGGER_SOURCES)[number]

/** Why a run was skipped, stopped or failed without an action error. Copy lives in admin data. */
export const RUN_REASONS = [
  'plan_limit',
  'loop_depth',
  'own_event',
  'dedupe',
  'imported',
  'test_order',
  'condition',
  'unsubscribed',
  'recipient_changed',
  'workflow_off',
  'circuit_breaker',
  'approval_declined',
  'approval_expired',
  'subject_missing',
  'cancelled_by_member',
] as const
export type RunReason = (typeof RUN_REASONS)[number]

/** Records a run touched, for "Automations on this record". */
export type RunRecordRole = 'subject' | 'changed'

/** A record a run is about or changed. `type` is a subject type (order, customer, product…). */
export type RecordRef = { type: SubjectType; id: string }

/** Carried by events an automation caused, so the trigger job can stop loops (§8.5). */
export type AutomationCause = { runId: string; workflowId: string; depth: number }

/** Runs started by events this deep (or deeper) in an automation chain are skipped. */
export const MAX_AUTOMATION_DEPTH = 3
/** Nodes per workflow (Flow-like). */
export const MAX_WORKFLOW_NODES = 50
/** Condition groups nest at most this deep (a group inside a group). */
export const MAX_RULE_DEPTH = 2
/** Wait bounds, in minutes: 1 minute to 60 days, as Growth today. */
export const MIN_WAIT_MINUTES = 1
export const MAX_WAIT_MINUTES = 60 * 24 * 60
/** Bulk "Run automation" cap per click. */
export const MAX_MANUAL_RECORDS = 250
/** Circuit breaker: runs of one workflow for one subject per hour. */
export const MAX_RUNS_PER_SUBJECT_HOUR = 50
/** Circuit breaker: failed runs of one workflow per hour. */
export const MAX_FAILURES_PER_HOUR = 1000
/** An action waiting for approval this long is declined. */
export const APPROVAL_EXPIRY_HOURS = 72
/** Step-run detail retention (summary runs are kept 13 months). */
export const STEP_RUN_RETENTION_DAYS = 30
export const RUN_RETENTION_MONTHS = 13
