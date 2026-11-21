'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'

type DesignTextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string | undefined
  hint?: string | undefined
  maxLength: number
}

/** A block's words (one line or a paragraph box); `{{variables}}` are typed in as text. */
export default function DesignTextField({
  id,
  label,
  value,
  onChange,
  multiline,
  placeholder,
  hint,
  maxLength,
}: DesignTextFieldProps) {
  // Render logic
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          rows={5}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  )
}
