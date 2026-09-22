'use client'

import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'

type TextSettingProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  help?: string | undefined
  error?: string | undefined
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  type?: 'text' | 'password'
}

/** One labelled text preference with help or its validation error underneath. */
export default function TextSetting({
  id,
  label,
  value,
  onChange,
  help,
  error,
  placeholder,
  maxLength,
  multiline,
  type = 'text',
}: TextSettingProps) {
  // Render logic
  const shared = {
    id,
    value,
    placeholder,
    maxLength,
    'aria-invalid': error ? true : undefined,
    autoComplete: 'off',
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea {...shared} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input {...shared} size="lg" type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : help ? (
        <FieldDescription>{help}</FieldDescription>
      ) : null}
    </Field>
  )
}
