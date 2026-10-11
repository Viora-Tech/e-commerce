'use client'

import PhoneInput from '@commerce/ui/phone-input'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'

type PhoneFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
  help?: string | undefined
}

/** A labelled phone input (flag + calling code picker) with help or error text under it. */
export default function PhoneField({ id, label, value, onChange, error, help }: PhoneFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <PhoneInput
        id={id}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        autoComplete="tel"
      />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : help ? (
        <FieldDescription>{help}</FieldDescription>
      ) : null}
    </Field>
  )
}
