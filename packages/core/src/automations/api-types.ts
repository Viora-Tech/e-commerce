/** SOURCE OF TRUTH: Automations API shapes — WHAT: the inputs (zod) and outputs (types) of the `automations.*` procedures: workflows, versions, runs, step runs, approvals, record history, test runs, usage and the editor catalogue / WHY: the router, the engine's services and the admin UI are built in parallel against this one contract. Pure, client-safe (`@commerce/core/automations`). */
import { z } from 'zod'
import type { ActionDescriptor, ConditionFieldDescriptor, TriggerDescriptor } from './catalogue'
import { type WorkflowDefinition, WorkflowDraftSchema } from './definition'
import type { TemplateCategory } from './templates'
import {
  MAX_MANUAL_RECORDS,
  RUN_STATUSES,
  type RunStatus,
  type StepRunStatus,
  type SubjectType,
  type WorkflowOrigin,
  type WorkflowStatus,
} from './types'

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

export const WorkflowIdInput = z.object({ id: z.uuid() })

export const WorkflowListInput = z
  .object({
    origin: z.enum(['automations', 'growth']).optional(),
    status: z.enum(['on', 'off']).optional(),
    query: z.string().trim().max(100).optional(),
  })
  .default({})

/** From a template, or blank with a trigger. */
export const WorkflowCreateInput = z.union([
  z.object({
    templateId: z.string().trim().min(1).max(80),
    name: z.string().trim().max(120).optional(),
  }),
  z.object({
    triggerType: z.string().trim().min(1).max(80),
    name: z.string().trim().max(120).optional(),
  }),
])

/** Saves the draft; the live version keeps running until Publish. */
export const WorkflowUpdateInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  /** Structure only, so a half-finished draft autosaves; publish runs the full checks. */
  draft: WorkflowDraftSchema.optional(),
})

export const WorkflowPublishInput = z.object({
  id: z.uuid(),
  /** The workflow's name typed out, required when it has a sensitive action. */
  confirmName: z.string().trim().max(120).optional(),
  /** Switch it on in the same step (first publish). */
  turnOn: z.boolean().default(true),
})

export const WorkflowSetStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(['on', 'off']),
  /** Turning off: what happens to runs that are waiting (asked in a confirm dialog). */
  waitingRuns: z.enum(['cancel', 'finish']).default('finish'),
})

export const WorkflowRestoreVersionInput = z.object({ id: z.uuid(), versionId: z.uuid() })

const SubjectRefInput = z.object({
  type: z.string().trim().min(1).max(60),
  id: z.uuid(),
})

/** "Test with a record": walks the draft (or `definition`) in a dry run. Writes nothing. */
export const WorkflowTestInput = z.object({
  id: z.uuid(),
  /** Unsaved editor state (may be half finished); defaults to the saved draft, then the live version. */
  definition: WorkflowDraftSchema.optional(),
  /** Null for subject-free triggers (schedule). */
  subject: SubjectRefInput.nullable(),
})

export const RunListInput = z
  .object({
    workflowId: z.uuid().optional(),
    status: z.enum(RUN_STATUSES).optional(),
    record: SubjectRefInput.optional(),
    /** Opaque cursor from the previous page. */
    cursor: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .default({ limit: 50 })

export const RunIdInput = z.object({ id: z.uuid() })

/** "Run automation" on one record or a selection (≤ 250). */
export const RunNowInput = z.object({
  workflowId: z.uuid(),
  subjectType: z.enum(['order', 'customer', 'product']),
  ids: z.array(z.uuid()).min(1).max(MAX_MANUAL_RECORDS),
  /** Client-made, so a double click starts nothing twice (`manual:<requestId>:<recordId>`). */
  requestId: z.uuid(),
})

export const ManualWorkflowsInput = z.object({
  subjectType: z.enum(['order', 'customer', 'product']),
})

export const RecordHistoryInput = z.object({
  type: z.string().trim().min(1).max(60),
  id: z.uuid(),
  limit: z.number().int().min(1).max(100).default(20),
})

export const ApprovalDecideInput = z.object({ stepRunId: z.uuid(), approve: z.boolean() })

// ---------------------------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------------------------

export type WorkflowSummary = {
  id: string
  name: string
  description: string
  status: WorkflowStatus
  origin: WorkflowOrigin
  templateId: string | null
  triggerType: string
  /** Unpublished edits exist. */
  hasDraft: boolean
  publishedVersion: number | null
  problem: string | null
  runsLast30Days: number
  /** Failed runs in the last 30 days (the list's Errors column). */
  errorRuns30d: number
  lastRunAt: string | null
  updatedAt: string
}

export type WorkflowVersionSummary = {
  id: string
  number: number
  publishedAt: string
  publishedBy: string | null
}

export type WorkflowDetail = WorkflowSummary & {
  /** The draft if there is one, else the live definition (what the editor opens). */
  definition: WorkflowDefinition
  published: WorkflowDefinition | null
  versions: WorkflowVersionSummary[]
  /** Runs parked on a wait or an approval (asked about when switching off). */
  openRuns: number
  /** Growth workflows with a branch or non-marketing action open read-only in Growth. */
  editableInGrowth: boolean
}

export type PublishIssue = { nodeId: string | null; code: string; message: string }

export type PublishResult =
  | { ok: true; version: number; status: WorkflowStatus }
  | { ok: false; issues: PublishIssue[]; needsConfirm: boolean }

export type SubjectLabel = { type: SubjectType; id: string | null; label: string }

export type RunSummary = {
  id: string
  workflowId: string
  workflowName: string
  versionNumber: number
  status: RunStatus
  triggerType: string
  subject: SubjectLabel
  isTest: boolean
  manual: boolean
  stopReason: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
  nextAt: string | null
}

export type StepRunView = {
  id: string
  nodeId: string
  /** 0 outside a For each; the pass (1, 2, 3…) inside one. */
  iteration: number
  kind: 'condition' | 'action' | 'wait' | 'find' | 'forEach'
  actionId: string | null
  status: StepRunStatus
  attempt: number
  /** Null for members without customers.read (customer data hidden, design §8.7). */
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  summary: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
  approval: { expiresAt: string | null; decidedBy: string | null; decidedAt: string | null } | null
}

export type RunDetail = RunSummary & {
  /** The version it ran on, to draw the path over. */
  definition: WorkflowDefinition
  steps: StepRunView[]
  /** Node ids in the order they ran. */
  path: string[]
  canRetry: boolean
  canCancel: boolean
}

export type RunPage = { runs: RunSummary[]; nextCursor: string | null }

/** One step of a dry run: what would happen, nothing changed. */
export type TestStep = {
  nodeId: string
  kind: 'condition' | 'action' | 'wait' | 'find' | 'forEach'
  actionId: string | null
  status: 'then' | 'otherwise' | 'would_run' | 'would_skip' | 'would_wait' | 'would_ask' | 'error'
  summary: string
  warnings: string[]
  output: Record<string, unknown> | null
}

export type TestRunResult = {
  subject: SubjectLabel | null
  steps: TestStep[]
  path: string[]
  /** Set when the run would not start at all (test order, imported, missing record). */
  blocked: string | null
}

export type RunNowResult = { started: number; skipped: number; requestId: string }

export type ManualWorkflow = {
  id: string
  name: string
  /** "This will: add tag VIP, cancel order (asks for approval)". */
  actions: { actionId: string; needsApproval: boolean }[]
  /** False when the member lacks an action's permission. */
  allowed: boolean
  /** The workflow's latest run of any kind, for the dialog's "Last run 2 days ago". */
  lastRunAt: string | null
}

export type RecordHistoryItem = {
  runId: string
  workflowId: string
  workflowName: string
  status: RunStatus
  role: 'subject' | 'changed'
  startedAt: string
}

export type ApprovalItem = {
  stepRunId: string
  runId: string
  workflowId: string
  workflowName: string
  actionId: string
  summary: string | null
  subject: SubjectLabel
  requestedAt: string
  expiresAt: string | null
  /** The member holds the action's permission. */
  canDecide: boolean
}

export type AutomationUsage = {
  month: string
  runs: number
  runsLimit: number
  activeWorkflows: number
  activeLimit: number | null
  connectors: boolean
  appInstalled: boolean
}

/** Descriptors without their zod schemas, for the editor. */
export type TriggerView = Omit<TriggerDescriptor, 'configSchema'>
export type ActionView = Omit<ActionDescriptor, 'configSchema'>

export type CatalogueView = {
  triggers: TriggerView[]
  actions: ActionView[]
  fields: ConditionFieldDescriptor[]
  /** Plugin trigger fields (`trigger.*`), keyed by trigger id. */
  pluginFields: Record<string, ConditionFieldDescriptor[]>
}

export type TemplateView = {
  id: string
  nameKey: string | null
  descriptionKey: string | null
  /** Plugin and Growth templates carry their own words. */
  name: string | null
  description: string | null
  category: TemplateCategory
  triggerType: string
  pluginId: string | null
  available: boolean
}
