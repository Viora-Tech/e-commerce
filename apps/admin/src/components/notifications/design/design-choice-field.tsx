'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'

type DesignChoiceFieldProps<T extends string> = {
  id: string
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

/** A small labelled select (size, alignment) for a block's settings. */
export default function DesignChoiceField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: DesignChoiceFieldProps<T>) {
  // Render logic
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        value={value}
        className="w-full"
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}
