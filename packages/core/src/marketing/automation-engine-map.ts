/** SOURCE OF TRUTH: Growth → Automations engine mapping — WHAT: pure functions that turn one `marketing_automation` (trigger, linear steps, settings) into an engine `WorkflowDefinition`, and one `marketing_automation_run` into its `automation_run` shape (status, cursor, subject) / WHY: the per-store cutover, its dry run and the parity tests must map the six marketing automations the same way, so a shopper mid-sequence gets exactly the messages they would have got. Design: docs/superpowers/specs/2026-10-23-automations-app-design.md §10. */
import {
  type ConditionNode,
  type NodeId,
  type Rule,
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowDefinition,
  type WorkflowNode,
} from '../automations/definition'
import type { RunStatus, SubjectType } from '../automations/types'
import {
  type AutomationStep,
  type AutomationTrigger,
  parseAutomationSettings,
  parseAutomationSteps,
  STOPS_ON_ORDER,
} from './automation-steps'

/** Old trigger → engine trigger id (design §10 table). */
export const ENGINE_TRIGGER: Record<AutomationTrigger, string> = {
  checkout_abandoned: 'checkout.abandoned',
  cart_abandoned: 'cart.abandoned',
  customer_subscribed: 'customer.subscribed',
  first_order: 'customer.first_order',
  customer_lapsed: 'customer.lapsed',
  cod_order_placed: 'order.cod_placed',
}

/** What each engine trigger's runs are about. */
export const ENGINE_SUBJECT: Record<AutomationTrigger, Extract<SubjectType, string>> = {
  checkout_abandoned: 'cart',
  cart_abandoned: 'cart',
  customer_subscribed: 'customer',
  first_order: 'order',
  customer_lapsed: 'customer',
  cod_order_placed: 'order',
}

/** Engine action ids of Growth's two message steps. */
export const SEND_EMAIL_ACTION = 'marketing.send_email'
export const SEND_WHATSAPP_ACTION = 'marketing.send_whatsapp'

const NODE_ID = /^[A-Za-z0-9_-]{1,40}$/

/** The legacy automation row, as far as the mapping reads it. */
export type LegacyAutomation = {
  id: string
  template: string
  trigger: string
  name: string
  status: 'active' | 'paused'
  steps: unknown
  settings: unknown
}

export type MappedWorkflow = {
  definition: WorkflowDefinition
  triggerType: string
  status: 'on' | 'off'
  /** Node id of each old step, by index (old messages and runs point at step indexes). */
  nodeIds: NodeId[]
}

/**
 * Node ids: the old step id when it is a valid, unused node id (design §10: node ids = step
 * ids), else `step-<index>`. Old ids were free text, so a hand-edited one may not fit.
 */
export function nodeIdsFor(steps: readonly AutomationStep[]): NodeId[] {
  const used = new Set<string>()
  return steps.map((step, i) => {
    let id = NODE_ID.test(step.id) && !used.has(step.id) ? step.id : `step-${i}`
    while (used.has(id)) id = `${id}-${i}`
    used.add(id)
    return id
  })
}

/** Where the subject's customer facts live per subject (`cart.customer.*`, `order.customer.*`). */
const customerRoot = (subject: string) =>
  subject === 'customer' ? 'customer' : `${subject}.customer`

/**
 * A rule that never holds, for a legacy condition the old runner could never pass (a basket
 * value on a trigger with no basket or order, or an unparseable number): the old runner
 * stopped those runs, so the engine must too. A customer always has a created date.
 */
const NEVER: Rule = { field: 'customer.created_at', op: 'is_empty' }
const neverFor = (subject: string): Rule => ({
  ...NEVER,
  field: `${customerRoot(subject)}.created_at`,
})

const OP: Record<'gte' | 'lte' | 'eq', Rule['op']> = { gte: 'gte', lte: 'lte', eq: 'eq' }

/** One legacy condition step as one engine rule, on the trigger's subject. */
export function ruleFor(
  step: Extract<AutomationStep, { type: 'condition' }>,
  subject: string,
): Rule {
  const root = customerRoot(subject)
  switch (step.field) {
    case 'cart_value': {
      const rupees = Number.parseFloat(step.value)
      // Lapsed and subscribed runs carry no basket or order: the old check never held.
      if (subject === 'customer' || !Number.isFinite(rupees)) return neverFor(subject)
      return { field: `${subject}.total`, op: OP[step.op], value: Math.round(rupees * 100) }
    }
    case 'order_count': {
      const n = Number.parseInt(step.value, 10)
      if (!Number.isFinite(n)) return neverFor(subject)
      return { field: `${root}.order_count`, op: OP[step.op], value: n }
    }
    case 'has_ordered':
      return { field: `${root}.has_ordered`, op: step.value === 'true' ? 'is_true' : 'is_false' }
    case 'accepts_marketing':
      return {
        field: `${root}.accepts_marketing`,
        op: step.value === 'true' ? 'is_true' : 'is_false',
      }
  }
}

/** Trigger config from the old settings, with the old runner's defaults. */
function triggerConfig(trigger: AutomationTrigger, settings: unknown): Record<string, unknown> {
  const s = parseAutomationSettings(settings)
  switch (trigger) {
    case 'checkout_abandoned':
      return { afterMinutes: s.afterMinutes ?? 60 }
    case 'cart_abandoned':
      return { afterMinutes: s.afterMinutes ?? 120 }
    case 'customer_lapsed':
      return { lapsedDays: s.lapsedDays ?? 90 }
    case 'first_order':
    case 'cod_order_placed':
      return { includeTest: false }
    case 'customer_subscribed':
      return {}
  }
}

export function isLegacyTrigger(t: string): t is AutomationTrigger {
  return t in ENGINE_TRIGGER
}

/**
 * The legacy automation as a straight-line workflow: steps 1:1 in order, waits as wait nodes,
 * email and WhatsApp as the marketing send actions (a step with no address or consent is
 * skipped, never fails the run, so `onError: 'continue'`), conditions as "continue only if"
 * (Otherwise ends the run as `stopped`, reason `condition`). `exitOnOrder` keeps
 * `STOPS_ON_ORDER`. Null for an unknown trigger.
 */
export function mapAutomation(a: LegacyAutomation): MappedWorkflow | null {
  if (!isLegacyTrigger(a.trigger)) return null
  const trigger = a.trigger
  const subject = ENGINE_SUBJECT[trigger]
  const steps = parseAutomationSteps(a.steps)
  const ids = nodeIdsFor(steps)
  const nodes: Record<NodeId, WorkflowNode> = {}
  steps.forEach((step, i) => {
    const id = ids[i] as NodeId
    const next = ids[i + 1] ?? null
    if (step.type === 'wait') {
      nodes[id] = { kind: 'wait', id, minutes: step.minutes, next }
    } else if (step.type === 'email') {
      nodes[id] = {
        kind: 'action',
        id,
        action: SEND_EMAIL_ACTION,
        config: { subject: step.subject, previewText: step.previewText, blocks: step.blocks },
        next,
        onError: 'continue',
      }
    } else if (step.type === 'whatsapp') {
      nodes[id] = {
        kind: 'action',
        id,
        action: SEND_WHATSAPP_ACTION,
        config: { template: step.template },
        next,
        onError: 'continue',
      }
    } else {
      const node: ConditionNode = {
        kind: 'condition',
        id,
        rules: { join: 'and', rules: [ruleFor(step, subject)] },
        next,
        otherwise: null,
        otherwiseStops: true,
      }
      nodes[id] = node
    }
  })
  return {
    definition: {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      trigger: { type: ENGINE_TRIGGER[trigger], config: triggerConfig(trigger, a.settings) },
      start: ids[0] ?? null,
      nodes,
      settings: STOPS_ON_ORDER[trigger] ? { exitOnOrder: true } : {},
    },
    triggerType: ENGINE_TRIGGER[trigger],
    status: a.status === 'active' ? 'on' : 'off',
    nodeIds: ids,
  }
}

/** The legacy run row, as far as the mapping reads it. */
export type LegacyRun = {
  status: 'active' | 'completed' | 'converted' | 'stopped'
  stepIndex: number
  customerId: string | null
  cartId: string | null
  orderId: string | null
}

export type MappedRun = {
  status: RunStatus
  /** The node to run next (the step at `step_index`); null once finished. */
  cursor: NodeId | null
  subjectType: string
  subjectId: string | null
}

/**
 * A legacy run on the engine. An active run parks as `waiting` on the node at its step index
 * with its `next_at` unchanged, so the engine tick resumes it exactly where the old tick would
 * have (the old runner already moved `step_index` past the wait it is sleeping on). An active
 * run past its last step (cannot happen, but old rows are data) completes.
 */
export function mapRun(
  trigger: AutomationTrigger,
  nodeIds: readonly NodeId[],
  run: LegacyRun,
): MappedRun {
  const subjectType = ENGINE_SUBJECT[trigger]
  const subjectId =
    subjectType === 'cart' ? run.cartId : subjectType === 'order' ? run.orderId : run.customerId
  const cursor = nodeIds[run.stepIndex] ?? null
  if (run.status !== 'active') return { status: run.status, cursor: null, subjectType, subjectId }
  return { status: cursor ? 'waiting' : 'completed', cursor, subjectType, subjectId }
}
