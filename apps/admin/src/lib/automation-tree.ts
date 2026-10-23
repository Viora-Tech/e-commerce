/**
 * Pure edits on a workflow definition's tree for the Automations editor: insert a step on an
 * edge, remove a step (splice an action or wait, drop a condition with everything under it),
 * patch a node, and fresh node ids. Every function returns a new definition; the input is
 * never mutated. The tree shape and names (`next` = Then, `otherwise`) follow
 * `@commerce/core/automations` definition.ts.
 */
import {
  type ActionNode,
  type ConditionFieldDescriptor,
  type ConditionNode,
  childrenOf,
  type NodeId,
  OPERATORS_BY_TYPE,
  type Rule,
  type WaitNode,
  type WorkflowDefinition,
  type WorkflowNode,
} from '@commerce/core/automations'

/** Where a new step goes: after the trigger, or on one branch of a node. */
export type Edge = { parent: null } | { parent: NodeId; branch: 'next' | 'otherwise' }

export type NewStep =
  | { kind: 'condition' }
  | { kind: 'wait' }
  | { kind: 'action'; action: string; needsApproval?: boolean | undefined }

/** The node an edge points at now (null at a branch end). */
export function childAt(def: WorkflowDefinition, edge: Edge): NodeId | null {
  if (edge.parent === null) return def.start
  const node = def.nodes[edge.parent]
  if (!node) return null
  if (edge.branch === 'otherwise') return node.kind === 'condition' ? node.otherwise : null
  return node.next
}

/** Short, readable ids (`action_2`), unique within the definition. */
export function freshNodeId(def: WorkflowDefinition, kind: WorkflowNode['kind']): NodeId {
  let n = 1
  while (def.nodes[`${kind}_${n}`]) n++
  return `${kind}_${n}`
}

const DEFAULT_WAIT_MINUTES = 60

function buildNode(id: NodeId, step: NewStep, next: NodeId | null): WorkflowNode {
  if (step.kind === 'condition') {
    const node: ConditionNode = {
      kind: 'condition',
      id,
      rules: { join: 'and', rules: [] },
      next,
      otherwise: null,
    }
    return node
  }
  if (step.kind === 'wait') {
    const node: WaitNode = { kind: 'wait', id, minutes: DEFAULT_WAIT_MINUTES, next }
    return node
  }
  const node: ActionNode = {
    kind: 'action',
    id,
    action: step.action,
    config: {},
    next,
    onError: 'stop',
    ...(step.needsApproval !== undefined ? { needsApproval: step.needsApproval } : {}),
  }
  return node
}

function pointEdge(def: WorkflowDefinition, edge: Edge, to: NodeId | null): WorkflowDefinition {
  if (edge.parent === null) return { ...def, start: to }
  const parent = def.nodes[edge.parent]
  if (!parent) return def
  const patched: WorkflowNode =
    edge.branch === 'otherwise' && parent.kind === 'condition'
      ? { ...parent, otherwise: to }
      : { ...parent, next: to }
  return { ...def, nodes: { ...def.nodes, [parent.id]: patched } }
}

/**
 * Puts a new step on `edge`. Whatever followed the edge now follows the new step (a new
 * condition keeps it on its Then branch, Otherwise starts empty). Returns the new id.
 */
export function insertStep(
  def: WorkflowDefinition,
  edge: Edge,
  step: NewStep,
): { def: WorkflowDefinition; id: NodeId } {
  const id = freshNodeId(def, step.kind)
  const node = buildNode(id, step, childAt(def, edge))
  const withNode = { ...def, nodes: { ...def.nodes, [id]: node } }
  return { def: pointEdge(withNode, edge, id), id }
}

/** The edge that points at `id`, or null when nothing does. */
export function edgeTo(def: WorkflowDefinition, id: NodeId): Edge | null {
  if (def.start === id) return { parent: null }
  for (const node of Object.values(def.nodes)) {
    if (node.next === id) return { parent: node.id, branch: 'next' }
    if (node.kind === 'condition' && node.otherwise === id) {
      return { parent: node.id, branch: 'otherwise' }
    }
  }
  return null
}

/** `id` and every node under it. */
export function subtreeIds(def: WorkflowDefinition, id: NodeId): NodeId[] {
  const out: NodeId[] = []
  const stack = [id]
  while (stack.length > 0) {
    const at = stack.pop() as NodeId
    const node = def.nodes[at]
    if (!node || out.includes(at)) continue
    out.push(at)
    for (const c of childrenOf(node)) if (c) stack.push(c)
  }
  return out
}

/** How many steps removing `id` takes away (1 for an action or wait). */
export function removalCount(def: WorkflowDefinition, id: NodeId): number {
  const node = def.nodes[id]
  if (!node) return 0
  return node.kind === 'condition' ? subtreeIds(def, id).length : 1
}

/**
 * Removes a step. An action or wait is spliced out (its parent now points at its `next`); a
 * condition goes with both of its branches, since they have nowhere else to hang.
 */
export function removeStep(def: WorkflowDefinition, id: NodeId): WorkflowDefinition {
  const node = def.nodes[id]
  if (!node) return def
  const edge = edgeTo(def, id)
  const gone = node.kind === 'condition' ? new Set(subtreeIds(def, id)) : new Set([id])
  const nodes = Object.fromEntries(Object.entries(def.nodes).filter(([key]) => !gone.has(key)))
  const rest = { ...def, nodes }
  const replacement = node.kind === 'condition' ? null : node.next
  return edge ? pointEdge(rest, edge, replacement) : rest
}

/** Replaces one node with a patched copy (same id). */
export function patchNode<N extends WorkflowNode>(
  def: WorkflowDefinition,
  id: NodeId,
  patch: (node: N) => N,
): WorkflowDefinition {
  const node = def.nodes[id]
  if (!node) return def
  return { ...def, nodes: { ...def.nodes, [id]: patch(node as N) } }
}

/** A new rule starts on the first field with its first operator, so the draft stays valid. */
export function firstRule(fields: ConditionFieldDescriptor[]): Rule {
  const field = fields[0]
  if (!field) return { field: 'order.total', op: 'gte' }
  return {
    field: field.path,
    op: OPERATORS_BY_TYPE[field.type][0] ?? 'eq',
    ...(field.list ? { quantifier: 'any' as const } : {}),
  }
}
