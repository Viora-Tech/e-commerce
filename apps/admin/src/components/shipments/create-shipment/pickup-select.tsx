'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type PickupSelectProps = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  hideLabel?: boolean
  placeholder?: string
  help?: string
}

/** A labelled select that can be locked (one pickup location, or the existing pickup's time). */
export default function PickupSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  hideLabel = false,
  placeholder,
  help,
}: PickupSelectProps) {
  // Render logic
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))

  return (
    <Field>
      <FieldLabel htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </FieldLabel>
      <Select
        items={items}
        value={value || null}
        disabled={disabled}
        onValueChange={(v) => v && onChange(String(v))}
      >
        <SelectTrigger size="lg" id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}
