'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type SelectFieldProps = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  help?: string | undefined
}

/** A labelled full-width select over a short fixed list, with a hint under it. */
export default function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  help,
}: SelectFieldProps) {
  // Render logic
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(String(v))}>
        <SelectTrigger size="lg" id={id} className="w-full">
          <SelectValue />
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
