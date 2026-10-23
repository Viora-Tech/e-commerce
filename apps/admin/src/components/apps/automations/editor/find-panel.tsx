'use client'

import {
  type ConditionFieldDescriptor,
  FIND_RESOURCES,
  type FindNode,
  MAX_FIND_RECORDS,
} from '@commerce/core/automations'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { automationLoopContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import RuleGroupEditor from './rule-group-editor'
import SelectInput from './select-input'

type FindPanelProps = {
  node: FindNode
  /** Every condition field; the panel offers the chosen record kind's. */
  fields: ConditionFieldDescriptor[]
  onChange: (node: FindNode) => void
}

const clampLimit = (n: number) => Math.min(MAX_FIND_RECORDS, Math.max(1, Math.round(n) || 1))

/** Find records: which kind, which rules (over that kind's fields) and how many at most. */
export default function FindPanel({ node, fields, onChange }: FindPanelProps) {
  // Hooks
  const copy = useCopy(automationLoopContent)

  // Render logic
  const own = fields.filter((f) => f.subject === node.resource)

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={`find-${node.id}-resource`}>{copy.resource}</FieldLabel>
        <SelectInput
          id={`find-${node.id}-resource`}
          value={node.resource}
          options={FIND_RESOURCES.map((r) => ({ value: r, label: copy.resources[r] ?? r }))}
          onChange={(resource) =>
            onChange({
              ...node,
              resource: resource as FindNode['resource'],
              // Rules read the old kind's fields; a new kind starts with none.
              rules: { join: 'and', rules: [] },
            })
          }
        />
      </Field>
      <div className="flex flex-col gap-2">
        <p className="text-caption text-muted-foreground">{copy.rulesHelp}</p>
        <RuleGroupEditor
          id={`find-${node.id}`}
          group={node.rules}
          fields={own}
          depth={1}
          onChange={(rules) => onChange({ ...node, rules })}
        />
      </div>
      <Field>
        <FieldLabel htmlFor={`find-${node.id}-limit`}>{copy.limit}</FieldLabel>
        <Input
          id={`find-${node.id}-limit`}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_FIND_RECORDS}
          value={node.limit}
          onChange={(e) => onChange({ ...node, limit: clampLimit(Number(e.target.value)) })}
          className="w-28"
        />
        <FieldDescription>{copy.limitHelp(MAX_FIND_RECORDS)}</FieldDescription>
      </Field>
    </div>
  )
}
