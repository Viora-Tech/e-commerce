import { permissions } from '@commerce/core'
import {
  ApprovalDecideInput,
  automationUsage,
  type CatalogueView,
  cancelRun,
  catalogueView,
  createWorkflow,
  decideApproval,
  deleteWorkflow,
  duplicateWorkflow,
  enqueueRunStep,
  evaluateRules,
  getRun,
  getWorkflow,
  listApprovals,
  listManualWorkflows,
  listRuns,
  listWorkflows,
  loadSubjectData,
  ManualWorkflowsInput,
  type Member,
  publishWorkflow,
  RecordHistoryInput,
  RunIdInput,
  RunListInput,
  RunNowInput,
  type RunNowResult,
  recordHistory,
  registerBuiltinActions,
  restoreVersion,
  retryRun,
  runNow,
  type StartedRun,
  setWorkflowStatus,
  templateViews,
  testWorkflow,
  updateWorkflow,
  WorkflowCreateInput,
  WorkflowError,
  WorkflowIdInput,
  WorkflowListInput,
  WorkflowPublishInput,
  WorkflowRestoreVersionInput,
  WorkflowSetStatusInput,
  WorkflowTestInput,
  WorkflowUpdateInput,
  workflowOrigin,
} from '@commerce/core/automations/server'
import type { Permission } from '@commerce/core/permissions'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { type AlsoNeeds, can, inputField } from '../procedures'

type Ctx = {
  tx: StoreTx
  scope: {
    storeId: string
    userId: string
    isOwner: boolean
    permissions: Permission[]
    can: (p: Permission) => boolean
  }
} & Pick<ApiContext, 'automationSteps'>

registerBuiltinActions()

const plugins = () => getRegistries().plugins

const member = (c: Ctx): Member => ({
  userId: c.scope.userId,
  isOwner: c.scope.isOwner,
  permissions: c.scope.permissions,
})

/** Core's refusals as oRPC errors; anything else is unexpected and reported. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof WorkflowError) throw new ORPCError(err.reason, { message: err.message })
    throw err
  }
}

/**
 * Growth's marketing workflows keep their own permissions (design §8.7): editing one here
 * also needs marketing.write, switching or publishing it marketing.send. Declared on the
 * procedure, so that grant's "Needs approval" tick holds the change here as it does in Growth.
 */
const growthNeeds =
  (permission: Permission): AlsoNeeds =>
  async (input, { tx }) => {
    const id = z.uuid().safeParse(inputField(input, 'id'))
    return id.success && (await workflowOrigin(tx, id.data)) === 'growth' ? [permission] : []
  }

/** Queue runs' next step now; the worker's tick is the fallback when there is no queue. */
async function enqueue(c: Ctx, runs: StartedRun[]) {
  for (const r of runs) {
    await enqueueRunStep(c.automationSteps, {
      storeId: c.scope.storeId,
      runId: r.runId,
      nextAt: r.nextAt,
    })
  }
}

/**
 * The Automations app (Shopify Flow equivalent): workflows, their versions and runs, the
 * editor's catalogue, dry runs, "Run automation" on records, approvals and record history.
 * Design: docs/superpowers/specs/2026-10-23-automations-app-design.md.
 */
export const automationsRouter = {
  /** The triggers, actions and condition fields this store can use in the editor. */
  catalogue: can(permissions.AUTOMATIONS_READ).handler(
    ({ context }): Promise<CatalogueView> =>
      catalogueView(context.tx, context.scope.storeId, plugins()),
  ),

  /** Template gallery: built-in, Growth's marketing ones and installed apps' templates. */
  templates: can(permissions.AUTOMATIONS_READ).handler(({ context }) =>
    templateViews(context.tx, context.scope.storeId, plugins()),
  ),

  /** Monthly runs and active workflows against the plan's limits. */
  usage: can(permissions.AUTOMATIONS_READ).handler(({ context }) =>
    automationUsage(context.tx, context.scope.storeId, plugins()),
  ),

  /** Every workflow in the store, Growth's marketing ones included (filter `origin`). */
  list: can(permissions.AUTOMATIONS_READ)
    .input(WorkflowListInput)
    .handler(({ context, input }) => listWorkflows(context.tx, context.scope.storeId, input)),

  /** One workflow with its draft, live definition, versions and open runs. */
  get: can(permissions.AUTOMATIONS_READ)
    .input(WorkflowIdInput)
    .handler(({ context, input }) => getWorkflow(context.tx, input.id)),

  /** Creates an Off workflow from a template or a trigger. */
  create: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowCreateInput)
    .handler(({ context, input }) =>
      guard(() => createWorkflow(context.tx, context.scope.storeId, input, member(context))),
    ),

  /** Saves the name, description or draft; the live version keeps running until Publish. */
  update: can(permissions.AUTOMATIONS_WRITE, growthNeeds(permissions.MARKETING_WRITE))
    .input(WorkflowUpdateInput)
    .handler(async ({ context, input }) => {
      return guard(() => updateWorkflow(context.tx, input))
    }),

  /** Publishes the draft as a new version (checks pieces, plan and the publisher's permissions). */
  publish: can(permissions.AUTOMATIONS_PUBLISH, growthNeeds(permissions.MARKETING_SEND))
    .input(WorkflowPublishInput)
    .handler(async ({ context, input }) => {
      return guard(() =>
        publishWorkflow(context.tx, context.scope.storeId, input, member(context), plugins()),
      )
    }),

  /** Turns a workflow on or off; off can cancel or let waiting runs finish. */
  setStatus: can(permissions.AUTOMATIONS_PUBLISH, growthNeeds(permissions.MARKETING_SEND))
    .input(WorkflowSetStatusInput)
    .handler(async ({ context, input }) => {
      return guard(() => setWorkflowStatus(context.tx, context.scope.storeId, input))
    }),

  /** Copies a version back into the draft. */
  restoreVersion: can(permissions.AUTOMATIONS_WRITE, growthNeeds(permissions.MARKETING_WRITE))
    .input(WorkflowRestoreVersionInput)
    .handler(async ({ context, input }) => {
      return guard(() => restoreVersion(context.tx, input))
    }),

  /** Copies a workflow as a new Off draft. */
  duplicate: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowIdInput)
    .handler(({ context, input }) =>
      guard(() => duplicateWorkflow(context.tx, context.scope.storeId, input.id, member(context))),
    ),

  /** Deletes a workflow with its versions and runs; open runs are cancelled. */
  delete: can(permissions.AUTOMATIONS_PUBLISH, growthNeeds(permissions.MARKETING_WRITE))
    .input(WorkflowIdInput)
    .handler(async ({ context, input }) => {
      return guard(() => deleteWorkflow(context.tx, input.id))
    }),

  /** Test with a record: walks the draft against real data, writes nothing. */
  testRun: can(permissions.AUTOMATIONS_WRITE)
    .input(WorkflowTestInput)
    .handler(({ context, input }) =>
      guard(() =>
        testWorkflow(context.tx, context.scope.storeId, input, {
          evaluate: evaluateRules,
          loadSubject: loadSubjectData,
          plugins: plugins(),
        }),
      ),
    ),

  /** On workflows with this record type's manual trigger, for the Run automation dialog. */
  listManual: can(permissions.AUTOMATIONS_RUN)
    .input(ManualWorkflowsInput)
    .handler(({ context, input }) =>
      listManualWorkflows(
        context.tx,
        context.scope.storeId,
        input.subjectType,
        member(context),
        plugins(),
      ),
    ),

  /** Run automation on one record or a selection (up to 250). */
  runNow: can(permissions.AUTOMATIONS_RUN)
    .input(RunNowInput)
    .handler(async ({ context, input }): Promise<RunNowResult> => {
      const r = await guard(() =>
        runNow(context.tx, context.scope.storeId, input, member(context), plugins()),
      )
      await enqueue(context, r.started)
      return { started: r.started.length, skipped: r.skipped, requestId: input.requestId }
    }),

  /** Automations on this record: runs about it or that changed it, newest first. */
  history: can(permissions.AUTOMATIONS_READ)
    .input(RecordHistoryInput)
    .handler(({ context, input }) => recordHistory(context.tx, input)),

  runs: {
    /** Runs, newest first, filtered by workflow, status or record. */
    list: can(permissions.AUTOMATIONS_READ)
      .input(RunListInput)
      .handler(({ context, input }) => listRuns(context.tx, input)),

    /** One run with each step's input, output and error, over the version it ran on. */
    get: can(permissions.AUTOMATIONS_READ)
      .input(RunIdInput)
      .handler(({ context, input }) => getRun(context.tx, input.id, member(context))),

    /** Retries a failed run from its failed step. */
    retry: can(permissions.AUTOMATIONS_PUBLISH)
      .input(RunIdInput)
      .handler(async ({ context, input }) => {
        const run = await guard(() => retryRun(context.tx, input.id))
        await enqueue(context, [run])
        return guard(async () => {
          const d = await getRun(context.tx, input.id, member(context))
          if (!d) throw new WorkflowError('NOT_FOUND', 'Run not found')
          return d
        })
      }),

    /** Cancels a queued, waiting or approval-waiting run. */
    cancel: can(permissions.AUTOMATIONS_PUBLISH)
      .input(RunIdInput)
      .handler(async ({ context, input }) => {
        await guard(() => cancelRun(context.tx, input.id))
        return guard(async () => {
          const d = await getRun(context.tx, input.id, member(context))
          if (!d) throw new WorkflowError('NOT_FOUND', 'Run not found')
          return d
        })
      }),
  },

  approvals: {
    /** Steps waiting for approval ("Ask before running"), oldest first. */
    list: can(permissions.AUTOMATIONS_READ).handler(({ context }) =>
      listApprovals(context.tx, context.scope.storeId, member(context), plugins()),
    ),

    /** Approves or declines a waiting step; needs the action's own permission. */
    decide: can(permissions.AUTOMATIONS_READ)
      .input(ApprovalDecideInput)
      .handler(async ({ context, input }) => {
        const r = await guard(() =>
          decideApproval(context.tx, context.scope.storeId, input, member(context), plugins()),
        )
        await enqueue(context, [r.run])
        return r.item
      }),
  },
}
