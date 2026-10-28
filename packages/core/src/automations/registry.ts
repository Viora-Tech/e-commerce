/** SOURCE OF TRUTH: automation piece registry — WHAT: resolves trigger and action descriptors (built-in plus installed plugins' `automations` blocks), holds the registered action executors, and checks a definition's pieces before publish (known ids, configs, subjects, plan tier, permissions, approval rules) / WHY: the API's publish, the editor's catalogue procedure and the worker must accept exactly the same pieces. Server-only. Design §8.4, §8.7, §8.9. */
import type { PluginManifest } from '@commerce/plugins'
import { z } from 'zod'
import type { PlanId } from '../billing/plans'
import { PLANS } from '../billing/plans'
import { isPermission, type Permission, permissions } from '../permissions/statement'
import {
  type ActionDescriptor,
  actionFitsSubject,
  BUILTIN_ACTIONS,
  BUILTIN_TRIGGERS,
  type FieldSpec,
  pluginIdOfPiece,
  type TriggerDescriptor,
  tierAllows,
} from './catalogue'
import { type ActionNode, nodeSubjects, type WorkflowDefinition } from './definition'
import type { ActionExecutor } from './executor'
import type { SubjectType } from './types'

const anyConfig = z.record(z.string(), z.unknown())

// ---------------------------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------------------------

const executors = new Map<string, ActionExecutor>()

/**
 * Register an action's server half under its catalogue id. Built-ins register from
 * `actions/index.ts` (imported by `server.ts`); a second registration of one id throws so two
 * files can never both own an action. `replace` is for the built-ins re-registering themselves:
 * the dev server re-runs `actions/index.ts` on hot reload while this map lives on, and the newest
 * code should win instead of the page crashing.
 */
export function registerActionExecutor<C>(
  executor: ActionExecutor<C>,
  opts: { replace?: boolean } = {},
): void {
  if (executors.has(executor.id) && !opts.replace) {
    throw new Error(`automation action "${executor.id}" registered twice`)
  }
  executors.set(executor.id, executor as unknown as ActionExecutor)
}

/** The executor for an action id, or null (not built yet, or a plugin action: see `pluginAction`). */
export const actionExecutor = (id: string): ActionExecutor | null => executors.get(id) ?? null

/** Test helper: forget registrations so a test can install mocks. */
export function resetActionExecutorsForTest(next: ActionExecutor[] = []): void {
  executors.clear()
  for (const e of next) executors.set(e.id, e)
}

// ---------------------------------------------------------------------------------------------
// Plugin pieces
// ---------------------------------------------------------------------------------------------

/** Plugin triggers as descriptors. Config is free-form JSON; conditions read `trigger.*`. */
function pluginTriggers(plugins: readonly PluginManifest[]): TriggerDescriptor[] {
  return plugins.flatMap((p) =>
    (p.automations?.triggers ?? []).map(
      (t): TriggerDescriptor => ({
        id: t.id,
        label: t.label,
        subject: t.subject,
        source: 'plugin',
        outboxTypes: ['automation.app_trigger'],
        group: 'manual',
        configSchema: anyConfig,
        configFields: [],
        planTier: 'starter',
        pluginId: p.id,
      }),
    ),
  )
}

/** Plugin actions as descriptors. Plugin actions are Growth+ (owner, 2026-10-23, Q1). */
function pluginActions(plugins: readonly PluginManifest[]): ActionDescriptor[] {
  return plugins.flatMap((p) =>
    (p.automations?.actions ?? []).map((a): ActionDescriptor => {
      const permission: Permission =
        a.permission && isPermission(a.permission) ? a.permission : permissions.SETTINGS_MANAGE
      return {
        id: a.id,
        label: a.label,
        subjects: a.subjects ?? 'any',
        resource: 'external',
        permission,
        risk: a.risk,
        dangerous: a.risk === 'sensitive',
        external: true,
        defaultNeedsApproval: false,
        approvalOwnerOnly: false,
        configSchema: anyConfig,
        configFields: a.configFields as FieldSpec[],
        planTier: 'growth',
        pluginId: p.id,
      }
    }),
  )
}

/** The manifest's own action (its `run`), for the plugin-action executor. */
export function pluginAction(plugins: readonly PluginManifest[], id: string) {
  const pluginId = pluginIdOfPiece(id)
  const plugin = plugins.find((p) => p.id === pluginId)
  return plugin?.automations?.actions?.find((a) => a.id === id) ?? null
}

/** The pieces one store may use: built-ins plus its installed apps'. */
export type PieceCatalogue = {
  triggers: TriggerDescriptor[]
  actions: ActionDescriptor[]
  trigger(id: string): TriggerDescriptor | null
  action(id: string): ActionDescriptor | null
}

/**
 * `installedPlugins`: the manifests of the apps this store installed. `appInstalled`: whether
 * the Automations app itself is installed; without it only Growth's marketing pieces resolve
 * (owner, Q3), which is what Growth's own workflows use.
 */
export function pieceCatalogue(input: {
  installedPlugins: readonly PluginManifest[]
  appInstalled: boolean
}): PieceCatalogue {
  const allow = (p: { marketing?: boolean | undefined }) =>
    input.appInstalled || p.marketing === true
  const triggers = [
    ...BUILTIN_TRIGGERS.filter(allow),
    ...(input.appInstalled ? pluginTriggers(input.installedPlugins) : []),
  ]
  const actions = [
    ...BUILTIN_ACTIONS.filter(allow),
    ...(input.appInstalled ? pluginActions(input.installedPlugins) : []),
  ]
  const tById = new Map(triggers.map((t) => [t.id, t]))
  const aById = new Map(actions.map((a) => [a.id, a]))
  return {
    triggers,
    actions,
    trigger: (id) => tById.get(id) ?? null,
    action: (id) => aById.get(id) ?? null,
  }
}

// ---------------------------------------------------------------------------------------------
// Publish check
// ---------------------------------------------------------------------------------------------

export type PieceIssueCode =
  | 'unknown_trigger'
  | 'unknown_action'
  | 'bad_config'
  | 'wrong_subject'
  | 'plan_tier'
  | 'missing_permission'
  | 'approval_owner_only'

export type PieceIssue = { nodeId: string | null; code: PieceIssueCode; message: string }

/**
 * Every piece is known to this store, configured validly, fits the trigger's subject, is on
 * the store's plan, and the publisher holds its permission (design §8.7: nobody automates what
 * they could not do by hand). Turning "Ask before running" off on Cancel order needs the Owner.
 */
export function pieceIssues(
  def: WorkflowDefinition,
  input: {
    catalogue: PieceCatalogue
    plan: PlanId
    /** The publisher's permissions; owners pass every permission. */
    memberPermissions: readonly Permission[]
    isOwner: boolean
  },
): PieceIssue[] {
  const issues: PieceIssue[] = []
  const trigger = input.catalogue.trigger(def.trigger.type)
  if (!trigger) {
    return [{ nodeId: null, code: 'unknown_trigger', message: 'This trigger is not available' }]
  }
  if (!trigger.configSchema.safeParse(def.trigger.config).success) {
    issues.push({ nodeId: null, code: 'bad_config', message: 'Check the trigger settings' })
  }
  const connectors = PLANS[input.plan].automations.connectors
  const held = new Set(input.memberPermissions)
  const subjects = nodeSubjects(def, trigger.subject)
  for (const node of Object.values(def.nodes)) {
    if (node.kind !== 'action') continue
    issues.push(
      ...actionIssues(node, subjects.get(node.id) ?? trigger.subject, {
        catalogue: input.catalogue,
        plan: input.plan,
        held,
        isOwner: input.isOwner,
        connectors,
      }),
    )
  }
  return issues
}

function actionIssues(
  node: ActionNode,
  subject: SubjectType,
  input: {
    catalogue: PieceCatalogue
    plan: PlanId
    held: Set<Permission>
    isOwner: boolean
    connectors: boolean
  },
): PieceIssue[] {
  const a = input.catalogue.action(node.action)
  if (!a) {
    return [{ nodeId: node.id, code: 'unknown_action', message: 'This action is not available' }]
  }
  const out: PieceIssue[] = []
  if (!a.configSchema.safeParse(node.config).success) {
    out.push({ nodeId: node.id, code: 'bad_config', message: 'Fill in this step' })
  }
  if (!actionFitsSubject(a, subject)) {
    out.push({
      nodeId: node.id,
      code: 'wrong_subject',
      message: 'This action does not work with this trigger',
    })
  }
  // Connectors (HTTP, plugin actions) follow the plan table; everything else its own tier.
  const allowed =
    a.external && a.resource === 'external' ? input.connectors : tierAllows(input.plan, a.planTier)
  if (!allowed) {
    out.push({ nodeId: node.id, code: 'plan_tier', message: 'Upgrade your plan to use this step' })
  }
  if (!input.isOwner && !input.held.has(a.permission)) {
    out.push({
      nodeId: node.id,
      code: 'missing_permission',
      message: `You need the ${a.permission} permission for this step`,
    })
  }
  if (a.approvalOwnerOnly && node.needsApproval === false && !input.isOwner) {
    out.push({
      nodeId: node.id,
      code: 'approval_owner_only',
      message: 'Only the store owner can turn off "Ask before running" here',
    })
  }
  return out
}
