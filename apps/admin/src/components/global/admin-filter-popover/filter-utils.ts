import type {
  AdminFilterField,
  AdminFilterNode,
  AdminFilterRuleNode,
  AdminTableFilterField,
} from './model'

function getFieldByKey(fields: readonly AdminFilterField[], fieldKey: string | null) {
  return fields.find((field) => field.key === fieldKey) ?? null
}

function getTableFieldByKey<T>(
  fields: readonly AdminTableFilterField<T>[],
  fieldKey: string | null,
) {
  return fields.find((field) => field.key === fieldKey) ?? null
}

function isRuleValid(rule: AdminFilterRuleNode, fields: readonly AdminFilterField[]) {
  const field = getFieldByKey(fields, rule.fieldKey)
  if (!field) return false

  const hasOperator = field.operators.some((operator) => operator.key === rule.operatorKey)
  if (!hasOperator) return false

  const trimmedValue = rule.value.trim()
  if (!trimmedValue) return false

  if (field.type === 'number') {
    return Number.isFinite(Number(trimmedValue))
  }

  if (field.type === 'enum') {
    return field.valueOptions?.some((option) => option.value === trimmedValue) ?? false
  }

  return true
}

function getValidAdminFilterNodes(
  nodes: readonly AdminFilterNode[],
  fields: readonly AdminFilterField[],
) {
  return nodes.flatMap<AdminFilterNode>((node) => {
    if (node.kind === 'rule') {
      return isRuleValid(node, fields) ? [{ ...node }] : []
    }

    const validRules = node.rules.filter((rule) => isRuleValid(rule, fields))
    return validRules.length > 0 ? [{ ...node, rules: validRules }] : []
  })
}

const normalizeTextValue = (value: string) => value.trim().toLowerCase()

function matchesTextRule(actualValue: string, rule: AdminFilterRuleNode) {
  const actual = normalizeTextValue(actualValue)
  const expected = normalizeTextValue(rule.value)

  if (rule.operatorKey === 'doesNotInclude') {
    return !actual.includes(expected)
  }

  if (rule.operatorKey === 'equals') {
    return actual === expected
  }

  return actual.includes(expected)
}

function matchesNumberRule(actualValue: number, rule: AdminFilterRuleNode) {
  const expected = Number(rule.value.trim())
  if (!Number.isFinite(expected)) return false

  if (rule.operatorKey === 'greaterThan') {
    return actualValue > expected
  }

  if (rule.operatorKey === 'lessThan') {
    return actualValue < expected
  }

  return actualValue === expected
}

function matchesEnumRule(actualValue: string, rule: AdminFilterRuleNode) {
  const expected = rule.value.trim()

  if (rule.operatorKey === 'isNot') {
    return actualValue !== expected
  }

  return actualValue === expected
}

function matchesAdminFilterRule<T>(
  item: T,
  rule: AdminFilterRuleNode,
  fields: readonly AdminTableFilterField<T>[],
) {
  const field = getTableFieldByKey(fields, rule.fieldKey)
  if (!field) return true

  const actualValue = field.getValue(item)

  if (field.type === 'text') {
    return matchesTextRule(String(actualValue), rule)
  }

  if (field.type === 'number') {
    return matchesNumberRule(Number(actualValue), rule)
  }

  return matchesEnumRule(String(actualValue), rule)
}

function matchesAdminFilters<T>(
  item: T,
  filterNodes: readonly AdminFilterNode[],
  fields: readonly AdminTableFilterField<T>[],
) {
  return filterNodes.every((node) => {
    if (node.kind === 'rule') {
      return matchesAdminFilterRule(item, node, fields)
    }

    return node.rules.every((rule) => matchesAdminFilterRule(item, rule, fields))
  })
}

export { getValidAdminFilterNodes, matchesAdminFilters }
