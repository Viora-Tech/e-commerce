'use client'

import {
  type ConditionFieldDescriptor,
  OPERATORS_BY_TYPE,
  type Rule,
  type RuleOperator,
  type RuleQuantifier,
} from '@commerce/core/automations'
import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { conditionFieldLabel } from '@/lib/automation-labels'
import RuleValueInput from './rule-value-input'
import SelectInput from './select-input'

type RuleRowProps = {
  id: string
  rule: Rule
  fields: ConditionFieldDescriptor[]
  onChange: (rule: Rule) => void
  onRemove: () => void
}

const QUANTIFIERS: RuleQuantifier[] = ['any', 'all', 'none']

/** One rule: field → operator → value, with Any/Every/No line item for list fields. */
export default function RuleRow({ id, rule, fields, onChange, onRemove }: RuleRowProps) {
  // Hooks
  const { condition: copy } = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)

  // Event handlers
  const handleField = (path: string) => {
    const next = fields.find((f) => f.path === path)
    if (!next) return
    const op = OPERATORS_BY_TYPE[next.type][0] as RuleOperator
    onChange({ field: path, op, ...(next.list ? { quantifier: 'any' as const } : {}) })
  }

  // Render logic
  const field = fields.find((f) => f.path === rule.field)
  const ops = field ? OPERATORS_BY_TYPE[field.type] : []

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {field?.list ? (
            <SelectInput
              aria-label={copy.quantifierLabel}
              value={rule.quantifier ?? 'any'}
              options={QUANTIFIERS.map((q) => ({ value: q, label: copy.quantifier[q] }))}
              onChange={(q) => onChange({ ...rule, quantifier: q as RuleQuantifier })}
            />
          ) : null}
          <SelectInput
            id={`${id}-field`}
            aria-label={copy.field}
            placeholder={copy.pickField}
            value={field ? rule.field : null}
            options={fields.map((f) => ({
              value: f.path,
              label: conditionFieldLabel(pieces, f, f.path),
            }))}
            onChange={handleField}
          />
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={copy.removeRule} onClick={onRemove}>
          <X />
        </Button>
      </div>
      {field ? (
        <div className="flex flex-col gap-2">
          <SelectInput
            aria-label={copy.operator}
            value={rule.op}
            options={ops.map((op) => ({ value: op, label: copy.ops[op] ?? op }))}
            onChange={(op) => {
              const { value: _drop, ...rest } = rule
              onChange({ ...rest, op: op as RuleOperator })
            }}
          />
          <RuleValueInput
            id={`${id}-value`}
            field={field}
            op={rule.op}
            value={rule.value}
            onChange={(value) => onChange({ ...rule, value })}
          />
        </div>
      ) : null}
    </div>
  )
}
