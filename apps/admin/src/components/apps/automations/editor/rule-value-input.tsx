'use client'

import {
  type ConditionFieldDescriptor,
  type RuleOperator,
  UNARY_OPERATORS,
} from '@commerce/core/automations'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import DateField from '@/components/fields/date-field'
import MoneyInput from '@/components/fields/money-input'
import TagInput from '@/components/fields/tag-input'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { enumLabel } from '@/lib/automation-labels'
import SelectInput from './select-input'

type RuleValueInputProps = {
  id: string
  field: ConditionFieldDescriptor
  op: RuleOperator
  value: unknown
  onChange: (value: unknown) => void
}

const asList = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

type ControlInput = RuleValueInputProps & {
  label: string
  days: string
  tagsPlaceholder: string
  pieces: Record<string, string>
}

/** The control for the field's type and operator. */
function valueControl({
  id,
  field,
  op,
  value,
  onChange,
  label,
  days,
  tagsPlaceholder,
  pieces,
}: ControlInput) {
  if (op === 'within_last_days' || op === 'older_than_days') {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={1}
          aria-label={label}
          className="w-24"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
        <span className="text-body text-muted-foreground">{days}</span>
      </div>
    )
  }
  if (field.type === 'money') {
    return (
      <MoneyInput
        id={id}
        aria-label={label}
        value={typeof value === 'number' ? String(value / 100) : ''}
        onChange={(v) => onChange(v === '' ? undefined : Math.round(Number(v) * 100))}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <Input
        id={id}
        type="number"
        aria-label={label}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    )
  }
  if (field.type === 'date') {
    return (
      <DateField
        id={id}
        aria-label={label}
        value={typeof value === 'string' ? value.slice(0, 10) : ''}
        onChange={(v) => onChange(v || undefined)}
      />
    )
  }
  if (field.type === 'tags') {
    return (
      <TagInput
        id={id}
        tags={asList(value)}
        suggestions={[]}
        placeholder={tagsPlaceholder}
        onChange={onChange}
      />
    )
  }
  if (field.type === 'enum') {
    const options = (field.options ?? []).map((o) => ({
      value: o,
      label: enumLabel(pieces, field.path, o),
    }))
    if (op !== 'is_one_of') {
      return (
        <SelectInput
          id={id}
          aria-label={label}
          value={typeof value === 'string' ? value : null}
          options={options}
          onChange={onChange}
        />
      )
    }
    const picked = asList(value)
    return (
      <fieldset id={id} aria-label={label} className="flex flex-col gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            htmlFor={`${id}-${o.value}`}
            className="flex items-center gap-2 text-body"
          >
            <Checkbox
              id={`${id}-${o.value}`}
              checked={picked.includes(o.value)}
              onCheckedChange={(on) =>
                onChange(on ? [...picked, o.value] : picked.filter((x) => x !== o.value))
              }
            />
            {o.label}
          </label>
        ))}
      </fieldset>
    )
  }
  return (
    <Input
      id={id}
      aria-label={label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** The value box of a rule, typed by its field: ₹ for money, chips for tags, a date, enum options. */
export default function RuleValueInput(props: RuleValueInputProps) {
  // Hooks
  const { condition: copy, fields } = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)

  // Early returns
  if (UNARY_OPERATORS.has(props.op)) return null

  // Render logic
  return valueControl({
    ...props,
    label: copy.value,
    days: copy.days,
    tagsPlaceholder: fields.tagsPlaceholder,
    pieces,
  })
}
