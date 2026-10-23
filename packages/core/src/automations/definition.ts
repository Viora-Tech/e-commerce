/** SOURCE OF TRUTH: workflow definition — WHAT: the zod schema of a stored workflow (trigger, tree of condition / action / wait nodes, AND/OR rule groups, settings, schema version) and its tree checks / WHY: the editor, the API, the publish check and the worker's interpreter must agree on one shape; a version row stores exactly this JSON. Pure, client-safe (`@commerce/core/automations`). Design §8.2. */
import { z } from 'zod'
import { MAX_RULE_DEPTH, MAX_WAIT_MINUTES, MAX_WORKFLOW_NODES, MIN_WAIT_MINUTES } from './types'

/** Bumped when the stored shape changes; old versions are migrated on read, never rewritten. */
export const WORKFLOW_SCHEMA_VERSION = 1

/** `[a-z0-9_-]`, unique within the workflow. Growth's migrated step ids fit this. */
const NodeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, dashes and underscores')
export type NodeId = z.infer<typeof NodeIdSchema>

/**
 * A trigger or action id from the catalogue. Built-ins are bare (`order.paid`,
 * `order.add_tags`); plugin ones are namespaced `<pluginId>/<name>`.
 */
const PieceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^([a-z][a-z0-9-]*\/)?[a-z][a-z0-9_.-]*$/, 'Not a trigger or action id')

/** Comparison operators. Which ones a field allows depends on its type (`OPERATORS_BY_TYPE`). */
export const RULE_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'is_empty',
  'is_not_empty',
  'includes',
  'not_includes',
  'is_one_of',
  'before',
  'after',
  'within_last_days',
  'is_true',
  'is_false',
] as const
export type RuleOperator = (typeof RULE_OPERATORS)[number]

/** For list fields (line items, tags): does the rule hold for any, all or none of them. */
export const RULE_QUANTIFIERS = ['any', 'all', 'none'] as const
export type RuleQuantifier = (typeof RULE_QUANTIFIERS)[number]

const RuleSchema = z.object({
  /** Dotted path into the subject schema, e.g. `order.total`, `order.line_items.sku`. */
  field: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'Not a field path'),
  op: z.enum(RULE_OPERATORS),
  /** Typed by the field: money in paise, dates ISO, lists as arrays. Absent for unary ops. */
  value: z.unknown().optional(),
  quantifier: z.enum(RULE_QUANTIFIERS).optional(),
})
export type Rule = z.infer<typeof RuleSchema>

export type RuleGroup = { join: 'and' | 'or'; rules: (Rule | RuleGroup)[] }

export const RuleGroupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    join: z.enum(['and', 'or']),
    rules: z.array(z.union([RuleSchema, RuleGroupSchema])).max(30),
  }),
)

export const isRuleGroup = (r: Rule | RuleGroup): r is RuleGroup => 'join' in r

const ConditionNodeSchema = z.object({
  kind: z.literal('condition'),
  id: NodeIdSchema,
  /** Shown on the canvas; the editor fills a default from the rules. */
  label: z.string().trim().max(120).optional(),
  rules: RuleGroupSchema,
  /** The Then branch: where the run goes when the rules hold (named `next` like other nodes). */
  next: NodeIdSchema.nullable(),
  /** The Otherwise branch. */
  otherwise: NodeIdSchema.nullable(),
  /**
   * Growth's linear "continue only if": the Otherwise branch ends the run as `stopped`
   * (reason `condition`) instead of `completed`.
   */
  otherwiseStops: z.boolean().optional(),
})

const ActionNodeSchema = z.object({
  kind: z.literal('action'),
  id: NodeIdSchema,
  label: z.string().trim().max(120).optional(),
  action: PieceIdSchema,
  /** Validated against the action's own `configSchema` at publish (`validateWorkflowPieces`). */
  config: z.record(z.string(), z.unknown()).default({}),
  next: NodeIdSchema.nullable(),
  /** A failed action ends the run (`stop`) or the run carries on to `next` (`continue`). */
  onError: z.enum(['stop', 'continue']).default('stop'),
  /**
   * Ask before running: the step parks as `awaiting_approval`. Unset means the action's
   * default (Cancel order asks; turning that off needs the Owner, checked at publish).
   */
  needsApproval: z.boolean().optional(),
})

const WaitNodeSchema = z.object({
  kind: z.literal('wait'),
  id: NodeIdSchema,
  label: z.string().trim().max(120).optional(),
  minutes: z.number().int().min(MIN_WAIT_MINUTES).max(MAX_WAIT_MINUTES),
  next: NodeIdSchema.nullable(),
})

const WorkflowNodeSchema = z.discriminatedUnion('kind', [
  ConditionNodeSchema,
  ActionNodeSchema,
  WaitNodeSchema,
])
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>
export type ConditionNode = z.infer<typeof ConditionNodeSchema>
export type ActionNode = z.infer<typeof ActionNodeSchema>
export type WaitNode = z.infer<typeof WaitNodeSchema>
export type WorkflowNodeKind = WorkflowNode['kind']

const WorkflowTriggerSchema = z.object({
  type: PieceIdSchema,
  /** Validated against the trigger's `configSchema` (e.g. `{ includeTest }`, `{ afterMinutes }`). */
  config: z.record(z.string(), z.unknown()).default({}),
})
export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>

const WorkflowSettingsSchema = z.object({
  /** Marketing: end the run as `converted` when the subject's customer places an order. */
  exitOnOrder: z.boolean().optional(),
  /** Same subject, same workflow: no second run within N minutes (0 or unset = no limit). */
  dedupeMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 60)
    .optional(),
})
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>

const WorkflowDefinitionShape = z.object({
  schemaVersion: z.literal(WORKFLOW_SCHEMA_VERSION).default(WORKFLOW_SCHEMA_VERSION),
  trigger: WorkflowTriggerSchema,
  /** The first node after the trigger; null for an empty workflow (a draft). */
  start: NodeIdSchema.nullable(),
  nodes: z.record(NodeIdSchema, WorkflowNodeSchema),
  settings: WorkflowSettingsSchema.default({}),
})

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionShape>

/**
 * A draft as the editor autosaves it: the shape only, so a half-built tree (a dangling branch,
 * an unconnected step, too deep a group) still saves. Publish checks `WorkflowDefinitionSchema`.
 */
export const WorkflowDraftSchema = WorkflowDefinitionShape

/** Where a structural problem is, for the editor to point at. */
export type DefinitionIssue = { nodeId: NodeId | null; code: DefinitionIssueCode; message: string }
export type DefinitionIssueCode =
  | 'too_many_nodes'
  | 'id_mismatch'
  | 'missing_node'
  | 'shared_child'
  | 'cycle'
  | 'unreachable'
  | 'rule_depth'
  | 'empty_rules'

/** The ids a node points at, in branch order. */
export function childrenOf(node: WorkflowNode): (NodeId | null)[] {
  return node.kind === 'condition' ? [node.next, node.otherwise] : [node.next]
}

function ruleDepth(group: RuleGroup): number {
  let max = 1
  for (const r of group.rules) if (isRuleGroup(r)) max = Math.max(max, 1 + ruleDepth(r))
  return max
}

/**
 * Structural checks the zod shape cannot express: every pointer resolves, the graph is a tree
 * (no node has two parents, no cycles, everything reachable from `start`), ≤ 50 nodes, rule
 * nesting ≤ 2. Piece-level checks (known ids, configs, permissions, plan) live in the catalogue.
 */
export function definitionIssues(def: WorkflowDefinition): DefinitionIssue[] {
  const issues: DefinitionIssue[] = []
  const ids = Object.keys(def.nodes)
  if (ids.length > MAX_WORKFLOW_NODES) {
    issues.push({
      nodeId: null,
      code: 'too_many_nodes',
      message: `At most ${MAX_WORKFLOW_NODES} steps`,
    })
  }
  for (const [key, node] of Object.entries(def.nodes)) {
    if (node.id !== key) {
      issues.push({ nodeId: key, code: 'id_mismatch', message: 'Node id does not match its key' })
    }
    if (node.kind === 'condition') {
      if (ruleDepth(node.rules) > MAX_RULE_DEPTH) {
        issues.push({
          nodeId: key,
          code: 'rule_depth',
          message: `Groups nest at most ${MAX_RULE_DEPTH} deep`,
        })
      }
      if (node.rules.rules.length === 0) {
        issues.push({ nodeId: key, code: 'empty_rules', message: 'Add at least one rule' })
      }
    }
  }

  const parents = new Map<NodeId, NodeId | 'start'>()
  const claim = (child: NodeId | null, parent: NodeId | 'start') => {
    if (child === null) return
    if (!def.nodes[child]) {
      issues.push({
        nodeId: parent === 'start' ? null : parent,
        code: 'missing_node',
        message: `Points at a step that does not exist (${child})`,
      })
      return
    }
    if (parents.has(child)) {
      issues.push({
        nodeId: child,
        code: 'shared_child',
        message: 'A step can follow only one other step',
      })
      return
    }
    parents.set(child, parent)
  }
  claim(def.start, 'start')
  for (const node of Object.values(def.nodes)) for (const c of childrenOf(node)) claim(c, node.id)

  // Walk from start; a node seen twice on the walk is a cycle (with one parent each, any
  // revisit is one), anything never seen is unreachable.
  const seen = new Set<NodeId>()
  const stack: NodeId[] = def.start && def.nodes[def.start] ? [def.start] : []
  while (stack.length > 0) {
    const id = stack.pop() as NodeId
    if (seen.has(id)) {
      issues.push({ nodeId: id, code: 'cycle', message: 'Steps loop back on themselves' })
      continue
    }
    seen.add(id)
    const node = def.nodes[id]
    if (!node) continue
    // Follow only the edge that owns the child, so a shared child is reported once, as shared.
    for (const c of new Set(childrenOf(node))) if (c && parents.get(c) === node.id) stack.push(c)
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      issues.push({ nodeId: id, code: 'unreachable', message: 'This step is not connected' })
    }
  }
  return issues
}

/** The stored definition: shape plus tree checks. Use `.safeParse` on anything from a client. */
export const WorkflowDefinitionSchema = WorkflowDefinitionShape.superRefine((def, ctx) => {
  for (const issue of definitionIssues(def)) {
    ctx.addIssue({
      code: 'custom',
      message: issue.message,
      path: issue.nodeId ? ['nodes', issue.nodeId] : [],
      params: { code: issue.code },
    })
  }
})

/** An empty draft for a trigger. */
export function emptyDefinition(triggerType: string): WorkflowDefinition {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    trigger: { type: triggerType, config: {} },
    start: null,
    nodes: {},
    settings: {},
  }
}

/** Every node in walk order (depth first, Then before Otherwise), for the run view and tests. */
export function walkNodes(def: WorkflowDefinition): WorkflowNode[] {
  const out: WorkflowNode[] = []
  const stack: NodeId[] = def.start ? [def.start] : []
  const seen = new Set<NodeId>()
  while (stack.length > 0) {
    const id = stack.pop() as NodeId
    const node = def.nodes[id]
    if (!node || seen.has(id)) continue
    seen.add(id)
    out.push(node)
    const kids = childrenOf(node).filter((c): c is NodeId => c !== null)
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i] as NodeId)
  }
  return out
}

/** Action ids used by a definition (for permission, plan and plugin checks). */
export function actionIdsOf(def: WorkflowDefinition): string[] {
  return [
    ...new Set(
      Object.values(def.nodes)
        .filter((n): n is ActionNode => n.kind === 'action')
        .map((n) => n.action),
    ),
  ]
}
