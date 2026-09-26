'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import FieldFrame from './field-frame'

type Option = { label: string; value: string | number | boolean | undefined | null | object }

type CustomizeSelectFieldProps = {
  field: { label?: string; options: readonly Option[] }
  value: Option['value']
  onChange: (value: Option['value']) => void
  id?: string
  readOnly?: boolean
  name: string
}

/** Puck's `select` field: our own Select, matching every other choose-one field in the admin. */
export default function CustomizeSelectField({
  field,
  value,
  onChange,
  id,
  readOnly,
  name,
}: CustomizeSelectFieldProps) {
  // Render logic
  const label = field.label ?? name
  const stringValue = value === undefined || value === null ? null : String(value)
  const items = Object.fromEntries(field.options.map((o) => [String(o.value), o.label]))

  return (
    <FieldFrame label={label} htmlFor={id}>
      <Select
        items={items}
        value={stringValue}
        disabled={readOnly}
        onValueChange={(v) => {
          const option = field.options.find((o) => String(o.value) === String(v))
          if (option) onChange(option.value)
        }}
      >
        <SelectTrigger id={id} className={cn(FIELD_CONTROL, 'w-full')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={String(o.value)} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  )
}
