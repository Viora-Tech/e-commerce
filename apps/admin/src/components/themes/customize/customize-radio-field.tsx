'use client'

import { FieldToggle, SlidersHorizontal } from '@commerce/ui/icons'
import { Switch } from '@commerce/ui/shadcn/switch'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import FieldFrame from './field-frame'

type Option = { label: string; value: string | number | boolean | undefined | null | object }

type CustomizeRadioFieldProps = {
  field: { label?: string; options: readonly Option[] }
  value: Option['value']
  onChange: (value: Option['value']) => void
  id?: string
  readOnly?: boolean
  name: string
}

/**
 * Puck's `radio` field: a real switch for a plain true/false pair (our
 * `yesNo()` fields and the like), a segmented control for everything else up
 * to 4 options — which, in this app's fields, is everything else.
 */
export default function CustomizeRadioField({
  field,
  value,
  onChange,
  id,
  readOnly,
  name,
}: CustomizeRadioFieldProps) {
  // Render logic
  const label = field.label ?? name
  const isBooleanPair =
    field.options.length === 2 && field.options.every((o) => typeof o.value === 'boolean')

  if (isBooleanPair) {
    const checked = value === true
    const current = field.options.find((o) => o.value === value)
    return (
      <FieldFrame icon={FieldToggle} label={label}>
        <label htmlFor={id} className="flex items-center gap-2">
          <Switch
            id={id}
            checked={checked}
            disabled={readOnly}
            onCheckedChange={(next) => onChange(next)}
          />
          <span className="text-body text-foreground">{current?.label}</span>
        </label>
      </FieldFrame>
    )
  }

  const stringValue = value === undefined || value === null ? '' : String(value)
  return (
    <FieldFrame icon={SlidersHorizontal} label={label}>
      <ToggleGroup
        id={id}
        value={[stringValue]}
        disabled={readOnly}
        spacing={0}
        variant="outline"
        className="w-full"
        onValueChange={(values) => {
          const option = field.options.find((o) => String(o.value) === String(values[0]))
          if (option) onChange(option.value)
        }}
      >
        {field.options.map((o) => (
          <ToggleGroupItem key={String(o.value)} value={String(o.value)} className="flex-1">
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldFrame>
  )
}
