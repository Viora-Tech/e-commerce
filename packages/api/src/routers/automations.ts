import { permissions } from '@commerce/core'
import {
  ApprovalDecideInput,
  type ApprovalItem,
  type AutomationUsage,
  type CatalogueView,
  type ManualWorkflow,
  ManualWorkflowsInput,
  type PublishResult,
  RecordHistoryInput,
  type RecordHistoryItem,
  type RunDetail,
  RunIdInput,
  RunListInput,
  RunNowInput,
  type RunNowResult,
  type RunPage,
  type TemplateView,
  type TestRunResult,
  WorkflowCreateInput,
  type WorkflowDetail,
  WorkflowIdInput,
  WorkflowListInput,
  WorkflowPublishInput,
  WorkflowRestoreVersionInput,
  WorkflowSetStatusInput,
  type WorkflowSummary,
  WorkflowTestInput,
  WorkflowUpdateInput,
} from '@commerce/core/automations'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'

const notImplemented = (): never => {
  throw new ORPCError('NOT_IMPLEMENTED', { message: 'Automations: coming in this release' })
}

/**
 * The Automations app (Shopify Flow equivalent): workflows, their versions and runs, the
 * editor's catalogue, dry runs, "Run automation" on records, approvals and record history.
 * Design: docs/superpowers/specs/2026-10-23-automations-app-design.md.
 */
export const automationsRouter = {
  /** The triggers, actions and condition fields this store can use in the editor. */
  catalogue: can(permissions.AUTOMATIONS_READ).handler(
    async (): Promise<CatalogueView> => notImplemented(),
  ),

  /** Template gallery: built-in, Growth's marketing ones and installed apps' templates. */
  templates: can(permissions.AUTOMATIONS_READ).handler(
    async (): Promise<TemplateView[]> => notImplemented(),
  ),

  /** Monthly runs and active workflows against the plan's limits. */
  usage: can(permissions.AUTOMATIONS_READ).handler(
    async (): Promise<AutomationUsage> => notImplemented(),
  ),

  /** Every workflow in the store, Growth's marketing ones included (filter `origin`). */
  list: can(permissions.AUTOMATIONS_READ)
    .input(WorkflowListInput)
    .handler(async (): Promise<WorkflowSummary[]> => notImplemented()),

  /** One workflow with its draft, live definition, versions and open runs. */
  get: can(permissions.AUTOMATIONS_READ)
    .input(WorkflowIdInput)
    .handler(async (): Promise<WorkflowDetail | null> => notImplemented()),

  /** Creates an Off workflow from a template or a trigger. */
  create: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowCreateInput)
    .handler(async (): Promise<WorkflowDetail> => notImplemented()),

  /** Saves the name, description or draft; the live version keeps running until Publish. */
  update: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowUpdateInput)
    .handler(async (): Promise<WorkflowDetail> => notImplemented()),

  /** Publishes the draft as a new version (checks pieces, plan and the publisher's permissions). */
  publish: can(permissions.AUTOMATIONS_PUBLISH)
    .input(WorkflowPublishInput)
    .handler(async (): Promise<PublishResult> => notImplemented()),

  /** Turns a workflow on or off; off can cancel or let waiting runs finish. */
  setStatus: can(permissions.AUTOMATIONS_PUBLISH)
    .input(WorkflowSetStatusInput)
    .handler(async (): Promise<WorkflowDetail> => notImplemented()),

  /** Copies a version back into the draft. */
  restoreVersion: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowRestoreVersionInput)
    .handler(async (): Promise<WorkflowDetail> => notImplemented()),

  /** Copies a workflow as a new Off draft. */
  duplicate: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowIdInput)
    .handler(async (): Promise<WorkflowDetail> => notImplemented()),

  /** Deletes a workflow with its versions and runs; open runs are cancelled. */
  delete: can(permissions.AUTOMATIONS_PUBLISH)
    .input(WorkflowIdInput)
    .handler(async (): Promise<{ ok: true }> => notImplemented()),

  /** Test with a record: walks the draft against real data, writes nothing. */
  testRun: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowTestInput)
    .handler(async (): Promise<TestRunResult> => notImplemented()),

  /** On workflows with this record type's manual trigger, for the Run automation dialog. */
  listManual: can(permissions.AUTOMATIONS_RUN)
    .input(ManualWorkflowsInput)
    .handler(async (): Promise<ManualWorkflow[]> => notImplemented()),

  /** Run automation on one record or a selection (up to 250). */
  runNow: can(permissions.AUTOMATIONS_RUN)
    .input(RunNowInput)
    .handler(async (): Promise<RunNowResult> => notImplemented()),

  /** Automations on this record: runs about it or that changed it, newest first. */
  history: can(permissions.AUTOMATIONS_READ)
    .input(RecordHistoryInput)
    .handler(async (): Promise<RecordHistoryItem[]> => notImplemented()),

  runs: {
    /** Runs, newest first, filtered by workflow, status or record. */
    list: can(permissions.AUTOMATIONS_READ)
      .input(RunListInput)
      .handler(async (): Promise<RunPage> => notImplemented()),

    /** One run with each step's input, output and error, over the version it ran on. */
    get: can(permissions.AUTOMATIONS_READ)
      .input(RunIdInput)
      .handler(async (): Promise<RunDetail | null> => notImplemented()),

    /** Retries a failed run from its failed step. */
    retry: can(permissions.AUTOMATIONS_PUBLISH)
      .input(RunIdInput)
      .handler(async (): Promise<RunDetail> => notImplemented()),

    /** Cancels a queued, waiting or approval-waiting run. */
    cancel: can(permissions.AUTOMATIONS_PUBLISH)
      .input(RunIdInput)
      .handler(async (): Promise<RunDetail> => notImplemented()),
  },

  approvals: {
    /** Steps waiting for approval ("Ask before running"), oldest first. */
    list: can(permissions.AUTOMATIONS_READ).handler(
      async (): Promise<ApprovalItem[]> => notImplemented(),
    ),

    /** Approves or declines a waiting step; needs the action's own permission. */
    decide: can(permissions.AUTOMATIONS_READ)
      .input(ApprovalDecideInput)
      .handler(async (): Promise<ApprovalItem> => notImplemented()),
  },
}
