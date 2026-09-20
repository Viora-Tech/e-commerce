'use client'

import IconComponent from '@commerce/ui/global/icon-component'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@commerce/ui/shadcn/select'
import { type ReactNode, useEffect, useState } from 'react'
import { AdminFloatingSurface } from '@/components/global/admin-floating-surface'
import { useDraftId } from '@/hooks/use-draft-id'
import { getValidAdminFilterNodes } from './filter-utils'
import type {
  AdminFilterField,
  AdminFilterGroupNode,
  AdminFilterNode,
  AdminFilterRuleNode,
  AdminTableFilterField,
} from './model'
import { useAdminTableFilters } from './use-admin-table-filters'

const EMPTY_SELECT_VALUE = '__empty__'

type AdminFilterPopoverProps = {
  align?: 'start' | 'center' | 'end'
  appliedNodes: readonly AdminFilterNode[]
  fields: readonly AdminFilterField[]
  /** When true, each field may appear in at most one filter rule. */
  oneRulePerField?: boolean
  onAppliedNodesChange: (nodes: AdminFilterNode[]) => void
  sideOffset?: number
  trigger: ReactNode
}

const chooserItemClasses = cn(
  'flex h-10 w-full items-center rounded-xl bg-background px-4 text-left',
  'font-medium text-sm text-foreground/50 shadow-[inset_1px_1px_13.6px_0px_var(--shadow)]',
  'transition-colors hover:bg-secondary hover:text-secondary-foreground hover:shadow-top-inset',
)

const labelClasses = 'font-medium text-sm leading-5 text-foreground'
const addButtonClasses = cn(
  'flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-4',
  'font-medium text-sm text-secondary-foreground shadow-shadow-sm transition-colors',
  'hover:bg-secondary/40',
)

const addButtonWideClasses = cn(addButtonClasses, 'w-full justify-center')

const clearAllFiltersWideButtonClasses = cn(
  'flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border',
  'bg-destructive/10 px-4 font-medium text-destructive text-sm transition-colors',
  'hover:bg-destructive/20',
)

const selectTriggerClasses = cn(
  'h-9 justify-start gap-2 rounded-xl border-0 bg-secondary px-4 text-left',
  'font-medium text-sm text-secondary-foreground shadow-shadow-sm',
  'transition-colors hover:bg-secondary/80',
  'outline-hidden ring-0 focus:ring-0 focus-visible:ring-0',
  'data-[placeholder]:text-secondary-foreground/50',
)

const selectContentClasses = cn(
  'rounded-[16px] border-border bg-background p-2 text-foreground shadow-shadow-sm',
)

const selectItemClasses = cn(
  'h-10 rounded-xl px-4 font-medium text-sm text-foreground/70',
  'focus:bg-secondary focus:text-secondary-foreground',
  'data-[highlighted]:bg-secondary data-[highlighted]:text-secondary-foreground',
)

const textInputClasses = cn(
  'h-9 rounded-xl border-0 bg-secondary px-4 text-sm text-secondary-foreground',
  'shadow-shadow-sm outline-hidden placeholder:text-secondary-foreground/50',
)

const cloneNodes = (nodes: readonly AdminFilterNode[]): AdminFilterNode[] =>
  nodes.map((node) =>
    node.kind === 'rule'
      ? { ...node }
      : {
          ...node,
          rules: node.rules.map((rule) => ({ ...rule })),
        },
  )

const getFieldByKey = (fields: readonly AdminFilterField[], fieldKey: string | null) =>
  fields.find((field) => field.key === fieldKey) ?? null

const mapSelectValue = (value: string) => (value === EMPTY_SELECT_VALUE ? null : value)

const getUsedFieldKeys = (
  nodes: readonly AdminFilterNode[],
  excludeRuleId?: string,
): Set<string> => {
  const keys = new Set<string>()

  for (const node of nodes) {
    if (node.kind === 'rule') {
      if (node.id !== excludeRuleId && node.fieldKey) {
        keys.add(node.fieldKey)
      }
      continue
    }

    for (const rule of node.rules) {
      if (rule.id !== excludeRuleId && rule.fieldKey) {
        keys.add(rule.fieldKey)
      }
    }
  }

  return keys
}

const getSelectableFields = (
  fields: readonly AdminFilterField[],
  usedFieldKeys: Set<string>,
  currentFieldKey: string | null,
) => fields.filter((field) => field.key === currentFieldKey || !usedFieldKeys.has(field.key))

const removeButtonClasses = cn(
  'flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/30',
  'transition-colors hover:bg-secondary hover:text-foreground/60',
)

type RuleEditorProps = {
  fields: readonly AdminFilterField[]
  labelWidthClassName: string
  onRemove?: (() => void) | undefined
  onRuleChange: (nextRule: AdminFilterRuleNode) => void
  rule: AdminFilterRuleNode
  showWhereLabel: boolean
}

const RuleEditor = ({
  fields,
  labelWidthClassName,
  onRemove,
  onRuleChange,
  rule,
  showWhereLabel,
}: RuleEditorProps) => {
  const field = getFieldByKey(fields, rule.fieldKey)
  const operators = field?.operators ?? []

  const handleFieldChange = (nextFieldKey: string) => {
    const nextField = getFieldByKey(fields, mapSelectValue(nextFieldKey))
    onRuleChange({
      ...rule,
      fieldKey: nextField?.key ?? null,
      operatorKey: nextField?.operators[0]?.key ?? null,
      value: '',
    })
  }

  const handleOperatorChange = (nextOperatorKey: string) => {
    onRuleChange({
      ...rule,
      operatorKey: mapSelectValue(nextOperatorKey),
    })
  }

  const handleValueChange = (value: string) => {
    onRuleChange({
      ...rule,
      value: value.trimStart(),
    })
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      {showWhereLabel ? (
        <span className={cn(labelClasses, 'shrink-0', labelWidthClassName)}>Where</span>
      ) : null}

      <Select onValueChange={handleFieldChange} value={rule.fieldKey ?? EMPTY_SELECT_VALUE}>
        <SelectTrigger className={cn(selectTriggerClasses, 'w-36 shrink-0')}>
          {field ? <IconComponent className="size-5 opacity-50" icon={field.icon} /> : null}
          <span className="truncate">{field?.label ?? 'Select Field'}</span>
        </SelectTrigger>
        <SelectContent align="start" className={selectContentClasses}>
          <SelectItem className={selectItemClasses} value={EMPTY_SELECT_VALUE}>
            Select Field
          </SelectItem>
          {fields.map((option) => (
            <SelectItem className={selectItemClasses} key={option.key} value={option.key}>
              <div className="flex items-center gap-2">
                <IconComponent className="size-4 opacity-50" icon={option.icon} />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={handleOperatorChange} value={rule.operatorKey ?? EMPTY_SELECT_VALUE}>
        <SelectTrigger className={cn(selectTriggerClasses, 'w-24 shrink-0')}>
          <span className="truncate">
            {operators.find((operator) => operator.key === rule.operatorKey)?.label ??
              'Select Operator'}
          </span>
        </SelectTrigger>
        <SelectContent align="start" className={selectContentClasses}>
          <SelectItem className={selectItemClasses} value={EMPTY_SELECT_VALUE}>
            Select Operator
          </SelectItem>
          {operators.map((operator) => (
            <SelectItem className={selectItemClasses} key={operator.key} value={operator.key}>
              {operator.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {field?.type === 'enum' ? (
        <Select onValueChange={handleValueChange} value={rule.value || EMPTY_SELECT_VALUE}>
          <SelectTrigger className={cn(selectTriggerClasses, 'min-w-0 flex-1')}>
            <span className="truncate">
              {field.valueOptions?.find((option) => option.value === rule.value)?.label ??
                field?.placeholder ??
                'Enter Value'}
            </span>
          </SelectTrigger>
          <SelectContent align="start" className={selectContentClasses}>
            <SelectItem className={selectItemClasses} value={EMPTY_SELECT_VALUE}>
              {field?.placeholder ?? 'Enter Value'}
            </SelectItem>
            {field.valueOptions?.map((option) => (
              <SelectItem className={selectItemClasses} key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          className={cn(textInputClasses, 'min-w-0 flex-1')}
          inputMode={field?.type === 'number' ? 'numeric' : 'text'}
          onChange={(event) => handleValueChange(event.target.value)}
          placeholder={field?.placeholder ?? 'Enter Value'}
          type={field?.type === 'number' ? 'number' : 'text'}
          value={rule.value}
        />
      )}

      {onRemove ? (
        <Button
          aria-label="Remove filter"
          className={cn(removeButtonClasses, 'shrink-0')}
          onClick={onRemove}
          size="icon"
          title="Remove filter"
          type="button"
          variant="ghost"
        >
          <IconComponent className="size-4" icon="X" />
        </Button>
      ) : null}
    </div>
  )
}

type GroupEditorProps = {
  fields: readonly AdminFilterField[]
  group: AdminFilterGroupNode
  onAddRule: () => void
  onGroupChange: (nextGroup: AdminFilterGroupNode) => void
  onRemove: () => void
  onRemoveRule: (ruleId: string) => void
  showRemoveGroup: boolean
}

const GroupEditor = ({
  fields,
  group,
  onAddRule,
  onGroupChange,
  onRemove,
  onRemoveRule,
  showRemoveGroup,
}: GroupEditorProps) => {
  const [firstRule, ...restRules] = group.rules

  return (
    <div className="flex items-start gap-4">
      <span className={cn(labelClasses, 'mt-2.5 w-20')}>Where</span>
      <div className="flex flex-1 flex-col gap-4 rounded-xl bg-secondary/40 p-3">
        {firstRule ? (
          <RuleEditor
            fields={fields}
            labelWidthClassName="w-20"
            onRemove={group.rules.length > 1 ? () => onRemoveRule(firstRule.id) : undefined}
            onRuleChange={(nextRule) =>
              onGroupChange({
                ...group,
                rules: group.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)),
              })
            }
            rule={firstRule}
            showWhereLabel={false}
          />
        ) : null}

        {restRules.map((rule) => (
          <RuleEditor
            fields={fields}
            key={rule.id}
            labelWidthClassName="w-20"
            onRemove={() => onRemoveRule(rule.id)}
            onRuleChange={(nextRule) =>
              onGroupChange({
                ...group,
                rules: group.rules.map((currentRule) =>
                  currentRule.id === nextRule.id ? nextRule : currentRule,
                ),
              })
            }
            rule={rule}
            showWhereLabel={false}
          />
        ))}

        <Button className={addButtonWideClasses} onClick={onAddRule} type="button" variant="ghost">
          <IconComponent className="size-5 opacity-50" icon="Plus" />
          Add Filter
        </Button>
      </div>

      {showRemoveGroup ? (
        <Button
          aria-label="Remove filter group"
          className={cn(removeButtonClasses, 'mt-1.5')}
          onClick={onRemove}
          size="icon"
          title="Remove filter group"
          type="button"
          variant="ghost"
        >
          <IconComponent className="size-4" icon="X" />
        </Button>
      ) : null}
    </div>
  )
}

function AdminFilterPopover({
  align = 'end',
  appliedNodes,
  fields,
  oneRulePerField = false,
  onAppliedNodesChange,
  sideOffset = 8,
  trigger,
}: AdminFilterPopoverProps) {
  const nextFilterId = useDraftId('filter')
  const createRuleForField = (field: AdminFilterField | null): AdminFilterRuleNode => ({
    fieldKey: field?.key ?? null,
    id: nextFilterId(),
    kind: 'rule',
    operatorKey: field?.operators[0]?.key ?? null,
    value: '',
  })
  const createRule = (filterFields: readonly AdminFilterField[]): AdminFilterRuleNode =>
    createRuleForField(filterFields[0] ?? null)
  const createGroup = (filterFields: readonly AdminFilterField[]): AdminFilterGroupNode => ({
    id: nextFilterId(),
    kind: 'group',
    rules: [createRule(filterFields)],
  })

  const [isOpen, setIsOpen] = useState(false)
  const [draftNodes, setDraftNodes] = useState<AdminFilterNode[]>(() => cloneNodes(appliedNodes))

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftNodes(cloneNodes(appliedNodes))
    }
  }, [appliedNodes, isOpen])

  const updateDraftNodes = (
    updater: AdminFilterNode[] | ((current: AdminFilterNode[]) => AdminFilterNode[]),
  ) => {
    setDraftNodes((current) => {
      const nextDraftNodes = typeof updater === 'function' ? updater(current) : updater

      // Defer parent state update to avoid setState-during-render warning
      queueMicrotask(() => {
        onAppliedNodesChange(getValidAdminFilterNodes(nextDraftNodes, fields))
      })
      return nextDraftNodes
    })
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)

    if (open) {
      setDraftNodes(cloneNodes(appliedNodes))
    }
  }

  const getNextUnusedField = (nodes: readonly AdminFilterNode[]) => {
    const usedFieldKeys = getUsedFieldKeys(nodes)
    return fields.find((field) => !usedFieldKeys.has(field.key)) ?? null
  }

  const canAddMoreRules = (nodes: readonly AdminFilterNode[]) =>
    !oneRulePerField || getUsedFieldKeys(nodes).size < fields.length

  const addRootRule = () => {
    updateDraftNodes((current) => {
      if (!canAddMoreRules(current)) return current

      const nextField = oneRulePerField ? getNextUnusedField(current) : (fields[0] ?? null)
      if (oneRulePerField && !nextField) return current

      return [...current, oneRulePerField ? createRuleForField(nextField) : createRule(fields)]
    })
  }

  const addRootGroup = () => {
    if (oneRulePerField) return
    updateDraftNodes((current) => [...current, createGroup(fields)])
  }

  const getRuleFields = (nodes: readonly AdminFilterNode[], rule: AdminFilterRuleNode) => {
    if (!oneRulePerField) return fields
    return getSelectableFields(fields, getUsedFieldKeys(nodes, rule.id), rule.fieldKey)
  }

  const removeNode = (nodeId: string) => {
    updateDraftNodes((current) => current.filter((node) => node.id !== nodeId))
  }

  const removeRuleFromGroup = (groupId: string, ruleId: string) => {
    updateDraftNodes((current) =>
      current.map((node) => {
        if (node.id !== groupId || node.kind !== 'group') return node
        const nextRules = node.rules.filter((rule) => rule.id !== ruleId)
        return { ...node, rules: nextRules }
      }),
    )
  }

  const clearAllFilters = () => {
    updateDraftNodes([])
  }

  const hasExpandedLayout = !oneRulePerField && draftNodes.some((node) => node.kind === 'group')
  const showAddFilter = canAddMoreRules(draftNodes)

  return (
    <Popover onOpenChange={handleOpenChange} open={isOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        sideOffset={sideOffset}
      >
        {draftNodes.length === 0 ? (
          <AdminFloatingSurface className="w-[284px]">
            <div className="flex flex-col gap-1">
              <Button
                className={chooserItemClasses}
                onClick={() => updateDraftNodes([createRule(fields)])}
                type="button"
                variant="ghost"
              >
                Add Filter Rule
              </Button>
              {!oneRulePerField ? (
                <Button
                  className={chooserItemClasses}
                  onClick={() => updateDraftNodes([createGroup(fields)])}
                  type="button"
                  variant="ghost"
                >
                  Add Filter Group
                </Button>
              ) : null}
            </div>
          </AdminFloatingSurface>
        ) : hasExpandedLayout ? (
          <AdminFloatingSurface className="w-[876px] p-3">
            <div className="flex flex-col gap-4">
              {draftNodes.map((node) => {
                if (node.kind === 'group') {
                  return (
                    <GroupEditor
                      fields={fields}
                      group={node}
                      key={node.id}
                      onAddRule={() =>
                        updateDraftNodes((current) =>
                          current.map((currentNode) =>
                            currentNode.id === node.id && currentNode.kind === 'group'
                              ? {
                                  ...currentNode,
                                  rules: [...currentNode.rules, createRule(fields)],
                                }
                              : currentNode,
                          ),
                        )
                      }
                      onGroupChange={(nextGroup) =>
                        updateDraftNodes((current) =>
                          current.map((currentNode) =>
                            currentNode.id === nextGroup.id ? nextGroup : currentNode,
                          ),
                        )
                      }
                      onRemove={() => removeNode(node.id)}
                      onRemoveRule={(ruleId) => removeRuleFromGroup(node.id, ruleId)}
                      showRemoveGroup
                    />
                  )
                }

                return (
                  <RuleEditor
                    fields={getRuleFields(draftNodes, node)}
                    key={node.id}
                    labelWidthClassName="w-20"
                    onRemove={() => removeNode(node.id)}
                    onRuleChange={(nextRule) =>
                      updateDraftNodes((current) =>
                        current.map((currentNode) =>
                          currentNode.id === nextRule.id ? nextRule : currentNode,
                        ),
                      )
                    }
                    rule={node}
                    showWhereLabel
                  />
                )
              })}

              <div className="flex flex-col gap-1.5">
                {!oneRulePerField ? (
                  <Button
                    className={addButtonWideClasses}
                    onClick={addRootGroup}
                    type="button"
                    variant="ghost"
                  >
                    <IconComponent className="size-5 opacity-50" icon="Plus" />
                    Add Filter Group
                  </Button>
                ) : null}

                <Button
                  className={clearAllFiltersWideButtonClasses}
                  onClick={clearAllFilters}
                  type="button"
                  variant="ghost"
                >
                  <IconComponent className="size-4" icon="Trash2" />
                  Reset Filters
                </Button>
              </div>
            </div>
          </AdminFloatingSurface>
        ) : (
          <AdminFloatingSurface className="w-[687px] p-3">
            <div className="flex flex-col gap-4">
              {draftNodes.map((node) =>
                node.kind === 'rule' ? (
                  <RuleEditor
                    fields={getRuleFields(draftNodes, node)}
                    key={node.id}
                    labelWidthClassName="w-[45px]"
                    onRemove={() => removeNode(node.id)}
                    onRuleChange={(nextRule) =>
                      updateDraftNodes((current) =>
                        current.map((currentNode) =>
                          currentNode.id === nextRule.id ? nextRule : currentNode,
                        ),
                      )
                    }
                    rule={node}
                    showWhereLabel
                  />
                ) : null,
              )}

              <div className="flex flex-col gap-1.5">
                <Button
                  className={addButtonWideClasses}
                  disabled={!showAddFilter}
                  onClick={addRootRule}
                  type="button"
                  variant="ghost"
                >
                  <IconComponent className="size-5 opacity-50" icon="Plus" />
                  Add Filter
                </Button>

                <Button
                  className={clearAllFiltersWideButtonClasses}
                  onClick={clearAllFilters}
                  type="button"
                  variant="ghost"
                >
                  <IconComponent className="size-4" icon="Trash2" />
                  Reset Filters
                </Button>
              </div>
            </div>
          </AdminFloatingSurface>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { ENUM_OPERATORS, TEXT_OPERATORS } from './model'
export {
  type AdminFilterField,
  type AdminFilterNode,
  AdminFilterPopover,
  type AdminTableFilterField,
  useAdminTableFilters,
}
