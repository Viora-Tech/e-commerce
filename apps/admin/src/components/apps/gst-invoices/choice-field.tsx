'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'

type ChoiceFieldProps = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  help?: string | undefined
  placeholder?: string | undefined
}

/** A labelled select over a small fixed list. */
export default function ChoiceField({
  id,
  label,
  value,
  options,
  onChange,
  help,
  placeholder,
}: ChoiceFieldProps) {
  // Render logic
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value || null} onValueChange={(v) => v && onChange(String(v))}>
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
