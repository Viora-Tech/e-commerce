/** SOURCE OF TRUTH: automation catalogue — WHAT: every built-in trigger, action and condition field of the Automations engine (id, copy key, subject, config schema and form spec, permission, risk, plan tier), the descriptor shapes plugins contribute, and the operators per field type / WHY: the editor's pickers, the publish check, the MCP docs and the worker resolve pieces from this one list; executors attach to these ids in `actions/**`, never the other way round. Pure, client-safe (`@commerce/core/automations`). Design §8.2, §8.4. Piece/property shape after Activepieces (MIT), no code copied. */
import type { z } from 'zod'
import type { Permission } from '../permissions/statement'
import { BUILTIN_ACTIONS } from './builtin-actions'
import { BUILTIN_TRIGGERS } from './builtin-triggers'
import { CONDITION_FIELDS } from './condition-fields'
import type { RuleOperator } from './definition'
import type {
  ActionRisk,
  AutomationPlanTier,
  BuiltinSubjectType,
  SubjectType,
  TriggerSource,
} from './types'

// ---------------------------------------------------------------------------------------------
// Form specs: how the editor draws a piece's config, serialisable so plugins add config without
// React. Each `key` is a key of the piece's config object.
// ---------------------------------------------------------------------------------------------

/** Plugin copy travels with the manifest; built-in copy is a key into admin `data/automations.ts`. */
export type PieceText = { en: string; hi?: string | undefined }

type FieldBase = {
  key: string
  /** Built-ins: copy key (`automations.field.tags`). Plugins: `label` instead. */
  labelKey?: string | undefined
  label?: PieceText | undefined
  helpKey?: string | undefined
  help?: PieceText | undefined
  required?: boolean | undefined
}

export type FieldSpec = FieldBase &
  (
    | { type: 'text'; maxLength?: number | undefined }
    | { type: 'textarea'; maxLength?: number | undefined }
    /** Text with `{order.number}`-style merge tags; the editor offers the subject's tags. */
    | { type: 'template'; multiline?: boolean | undefined; maxLength?: number | undefined }
    | { type: 'number'; min?: number | undefined; max?: number | undefined }
    /** Entered in rupees, stored in paise. */
    | { type: 'money' }
    | { type: 'boolean' }
    | { type: 'select'; options: { value: string; labelKey?: string; label?: PieceText }[] }
    | { type: 'tags'; max?: number | undefined }
    | { type: 'emails'; max?: number | undefined }
    | { type: 'phones'; max?: number | undefined }
    /** Picks a record of the store, stored as its id. */
    | { type: 'record'; recordType: 'collection' | 'product' | 'customer' | 'location' }
    /** An `automation_secret` handle; the value never reaches the client. */
    | { type: 'secret' }
    /** A WhatsApp template from the store's channel; `utility` lists only utility ones. */
    | { type: 'whatsapp_template'; purpose: 'marketing' | 'utility' | 'staff' }
    /** One of the store's order email templates (Send order update). */
    | { type: 'order_email_template' }
    /** Growth's email designer (subject, preview text, blocks). */
    | { type: 'email_design' }
    | { type: 'key_value'; max?: number | undefined }
    | { type: 'minutes'; min?: number | undefined; max?: number | undefined }
    | { type: 'schedule' }
  )

// ---------------------------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------------------------

/** What the editor needs to show a piece, and the publish check needs to allow it. */
type PieceBase = {
  /** Built-ins bare (`order.paid`), plugin pieces `<pluginId>/<name>`. */
  id: string
  /** Built-ins: copy key in `data/automations.ts`. Plugins: `label`. */
  labelKey?: string | undefined
  label?: PieceText | undefined
  descriptionKey?: string | undefined
  /** Validates the piece's `config` at publish and before each run. */
  configSchema: z.ZodType<Record<string, unknown>>
  configFields: FieldSpec[]
  /** Lowest plan that may publish a workflow using it. */
  planTier: AutomationPlanTier
  /**
   * Usable by Growth's marketing automations without the Automations app installed
   * (owner, 2026-10-23, Q3). Everything else needs the app.
   */
  marketing?: boolean | undefined
  /** Set for plugin-contributed pieces; shown only while that app is installed. */
  pluginId?: string | undefined
}

export type TriggerDescriptor = PieceBase & {
  subject: SubjectType
  source: TriggerSource
  /** For `source: 'outbox'`: the outbox event types that can start it. */
  outboxTypes?: readonly string[] | undefined
  /** Editor grouping. */
  group: 'orders' | 'customers' | 'products' | 'inventory' | 'marketing' | 'schedule' | 'manual'
}

/** The store data an action changes, for the run log's "changed" records and app access checks. */
export type ActionResource =
  | 'orders'
  | 'customers'
  | 'products'
  | 'collections'
  | 'metafields'
  | 'staff-messages'
  | 'customer-messages'
  | 'external'

export type ActionDescriptor = PieceBase & {
  /** Subjects it works on; `any` for subject-free actions (staff alert, HTTP). */
  subjects: readonly SubjectType[] | 'any'
  resource: ActionResource
  /**
   * The member permission needed to publish (and to "Run automation" on a record) a workflow
   * that contains this action (design §8.7). Plugin actions name one of the statement's too.
   */
  permission: Permission
  risk: ActionRisk
  /** Sensitive actions: typed confirm at publish, badge on the canvas. */
  dangerous: boolean
  /** Leaves the platform (email/WhatsApp provider, HTTP, plugin): at-least-once, keyed retries. */
  external: boolean
  /** Asks before running unless the node says otherwise. */
  defaultNeedsApproval: boolean
  /** Only the Owner may switch "Ask before running" off for this action (Q2: Cancel order). */
  approvalOwnerOnly: boolean
}

/** Field value types the condition builder and evaluator know. */
export const FIELD_TYPES = ['number', 'money', 'text', 'tags', 'boolean', 'date', 'enum'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export type ConditionFieldDescriptor = {
  /** Dotted path, rooted at the subject (`order.total`, `order.line_items.sku`). */
  path: string
  labelKey: string
  /** The subject whose data the path reads (an order trigger can also read `order.customer.*`). */
  subject: BuiltinSubjectType
  type: FieldType
  /** Set when the path walks through a list (line items): rules on it take a quantifier. */
  list?: boolean | undefined
  /** For `enum`: the allowed values (copy keys `automations.enum.<path>.<value>`). */
  options?: readonly string[] | undefined
}

/** Which operators a field type allows, in picker order. */
export const OPERATORS_BY_TYPE: Record<FieldType, readonly RuleOperator[]> = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  money: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  text: ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty'],
  tags: ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
  boolean: ['is_true', 'is_false'],
  date: ['before', 'after', 'within_last_days', 'older_than_days'],
  enum: ['is_one_of', 'eq', 'neq'],
}

/** Operators that take no value. */
export const UNARY_OPERATORS: ReadonlySet<RuleOperator> = new Set([
  'is_empty',
  'is_not_empty',
  'is_true',
  'is_false',
])

export { BUILTIN_ACTION_IDS, BUILTIN_ACTIONS, type BuiltinActionId } from './builtin-actions'
export { BUILTIN_TRIGGER_IDS, BUILTIN_TRIGGERS, type BuiltinTriggerId } from './builtin-triggers'
export { CONDITION_FIELDS } from './condition-fields'

// ---------------------------------------------------------------------------------------------
// Lookups. Plugin pieces are merged in by the server registry (`registry.ts`); these see
// built-ins only, which is all a client without the app list needs.
// ---------------------------------------------------------------------------------------------

export const isPluginPieceId = (id: string): boolean => id.includes('/')
export const pluginIdOfPiece = (id: string): string | null =>
  isPluginPieceId(id) ? (id.split('/')[0] ?? null) : null

const TRIGGERS_BY_ID = new Map(BUILTIN_TRIGGERS.map((t) => [t.id, t]))
const ACTIONS_BY_ID = new Map(BUILTIN_ACTIONS.map((a) => [a.id, a]))

export const builtinTrigger = (id: string): TriggerDescriptor | null =>
  TRIGGERS_BY_ID.get(id) ?? null
export const builtinAction = (id: string): ActionDescriptor | null => ACTIONS_BY_ID.get(id) ?? null

/** Condition fields a trigger's subject can read. */
export const conditionFieldsFor = (subject: SubjectType): ConditionFieldDescriptor[] =>
  CONDITION_FIELDS.filter((field) => field.subject === subject)

/** True when the action can run on runs about `subject`. */
export function actionFitsSubject(a: ActionDescriptor, subject: SubjectType): boolean {
  return a.subjects === 'any' || a.subjects.includes(subject)
}

const TIER_RANK: Record<AutomationPlanTier, number> = { starter: 0, growth: 1, pro: 2 }
/** True when a store on `plan` may use a piece of `tier`. */
export const tierAllows = (plan: AutomationPlanTier, tier: AutomationPlanTier): boolean =>
  TIER_RANK[plan] >= TIER_RANK[tier]

/** Does this node ask before running: its own switch, else the action's default. */
export const nodeNeedsApproval = (
  a: Pick<ActionDescriptor, 'defaultNeedsApproval'>,
  needsApproval: boolean | undefined,
): boolean => needsApproval ?? a.defaultNeedsApproval
