import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'

type GeneralTextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | undefined
  help?: string | undefined
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel'
}

/** One labelled text box on Settings › General, with its help line or error. */
export default function GeneralTextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  type,
  autoComplete,
  inputMode,
}: GeneralTextFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        size="lg"
        id={id}
        type={type ?? 'text'}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete ?? 'off'}
      />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : help ? (
        <FieldDescription>{help}</FieldDescription>
      ) : null}
    </Field>
  )
}
