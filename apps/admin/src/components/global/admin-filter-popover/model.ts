type AdminFilterOperator = {
  key: string
  label: string
}

type AdminFilterValueOption = {
  label: string
  value: string
}

type AdminFilterField = {
  icon: string
  key: string
  label: string
  operators: readonly AdminFilterOperator[]
  placeholder?: string
  type: 'text' | 'number' | 'enum'
  valueOptions?: readonly AdminFilterValueOption[]
}

type AdminTableFilterField<T> = AdminFilterField & {
  getValue: (item: T) => number | string
}

type AdminFilterRuleNode = {
  fieldKey: string | null
  id: string
  kind: 'rule'
  operatorKey: string | null
  value: string
}

type AdminFilterGroupNode = {
  id: string
  kind: 'group'
  rules: AdminFilterRuleNode[]
}

type AdminFilterNode = AdminFilterGroupNode | AdminFilterRuleNode

const TEXT_OPERATORS = [
  { key: 'includes', label: 'Includes' },
  { key: 'doesNotInclude', label: 'Does Not Include' },
  { key: 'equals', label: 'Equals' },
] as const

const ENUM_OPERATORS = [
  { key: 'is', label: 'Is' },
  { key: 'isNot', label: 'Is Not' },
] as const

export type {
  AdminFilterField,
  AdminFilterGroupNode,
  AdminFilterNode,
  AdminFilterOperator,
  AdminFilterRuleNode,
  AdminFilterValueOption,
  AdminTableFilterField,
}
export { ENUM_OPERATORS, TEXT_OPERATORS }
