/**
 * What the Automations editor flags before publish, without a round trip: the definition's
 * tree checks (`definitionIssues`) plus the piece checks the browser can make from the
 * catalogue (known trigger and actions, required fields, subject fit, plan tier, finished
 * rules). The server's publish repeats all of it with permissions (`pieceIssues`) and its
 * answer replaces these.
 */
import {
  type ActionNode,
  type ActionView,
  type AutomationPlanTier,
  type CatalogueView,
  definitionIssues,
  type FieldSpec,
  isRuleGroup,
  nodeNeedsApproval,
  nodeSubjects,
  type RuleGroup,
  tierAllows,
  UNARY_OPERATORS,
  type WorkflowDefinition,
} from '@commerce/core/automations'
import type { automationEditorContent } from '@/data/automations'

export type EditorIssue = { nodeId: string | null; message: string }

type IssueCopy = (typeof automationEditorContent)['issues']

const isEmptyValue = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/** Required fields left empty, by field key. */
export function missingFields(fields: FieldSpec[], config: Record<string, unknown>): FieldSpec[] {
  return fields.filter((f) => f.required && isEmptyValue(config[f.key]))
}

function rulesFinished(group: RuleGroup): boolean {
  return group.rules.every((r) =>
    isRuleGroup(r)
      ? r.rules.length > 0 && rulesFinished(r)
      : Boolean(r.field) && (UNARY_OPERATORS.has(r.op) || !isEmptyValue(r.value)),
  )
}

export function editorIssues(
  def: WorkflowDefinition,
  catalogue: CatalogueView,
  input: { plan: AutomationPlanTier | null; copy: IssueCopy; fieldName: (f: FieldSpec) => string },
): EditorIssue[] {
  const { copy } = input
  const issues: EditorIssue[] = definitionIssues(def).map((i) => ({
    nodeId: i.nodeId,
    message: i.code === 'empty_rules' ? copy.emptyRules : i.message,
  }))
  const trigger = catalogue.triggers.find((t) => t.id === def.trigger.type)
  if (!trigger) issues.push({ nodeId: null, message: copy.unknown })
  else {
    for (const f of missingFields(trigger.configFields, def.trigger.config)) {
      issues.push({ nodeId: null, message: copy.missing(input.fieldName(f)) })
    }
  }
  if (!def.start) issues.push({ nodeId: null, message: copy.noSteps })
  const actions = new Map<string, ActionView>(catalogue.actions.map((a) => [a.id, a]))
  const subjects = trigger ? nodeSubjects(def, trigger.subject) : new Map<string, string>()
  for (const node of Object.values(def.nodes)) {
    if (node.kind === 'find') {
      if (!rulesFinished(node.rules)) issues.push({ nodeId: node.id, message: copy.incompleteRule })
      continue
    }
    if (node.kind === 'condition') {
      if (node.rules.rules.length > 0 && !rulesFinished(node.rules)) {
        issues.push({ nodeId: node.id, message: copy.incompleteRule })
      }
      continue
    }
    if (node.kind !== 'action') continue
    const a = actions.get(node.action)
    if (!a) {
      issues.push({ nodeId: node.id, message: copy.unknown })
      continue
    }
    for (const f of missingFields(a.configFields, node.config)) {
      issues.push({ nodeId: node.id, message: copy.missing(input.fieldName(f)) })
    }
    const at = subjects.get(node.id) ?? trigger?.subject
    if (at && a.subjects !== 'any' && !a.subjects.includes(at)) {
      issues.push({ nodeId: node.id, message: copy.wrongSubject })
    }
    if (input.plan && !tierAllows(input.plan, a.planTier)) {
      issues.push({ nodeId: node.id, message: copy.planTier })
    }
  }
  return issues
}

/** The sensitive steps (typed confirm at publish) and whether one of them asks before running. */
export function riskSummary(
  def: WorkflowDefinition,
  catalogue: CatalogueView,
): { sensitive: ActionNode[]; asksApproval: boolean } {
  const sensitive = Object.values(def.nodes).filter(
    (n): n is ActionNode =>
      n.kind === 'action' && catalogue.actions.find((a) => a.id === n.action)?.risk === 'sensitive',
  )
  const asksApproval = sensitive.some((n) => {
    const a = catalogue.actions.find((x) => x.id === n.action)
    return a ? nodeNeedsApproval(a, n.needsApproval) : false
  })
  return { sensitive, asksApproval }
}
