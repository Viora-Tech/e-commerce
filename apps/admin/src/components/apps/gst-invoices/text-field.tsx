'use client'

import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'

type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
  help?: string | undefined
  multiline?: boolean
  maxLength?: number
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
}

/** A labelled input with help or error text under it. */
export default function TextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  multiline,
  maxLength,
  inputMode,
}: TextFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="min-h-20"
        />
      ) : (
        <Input
          size="lg"
          id={id}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
        />
      )}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : help ? (
        <FieldDescription>{help}</FieldDescription>
      ) : null}
    </Field>
  )
}
