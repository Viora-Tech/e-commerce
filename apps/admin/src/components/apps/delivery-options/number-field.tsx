import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import MoneyInput from '@/components/fields/money-input'

type NumberFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string | undefined
}

/** A number field without the ₹ sign (days, %) on an option's page. */
export default function NumberField({ id, label, value, onChange, suffix }: NumberFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <MoneyInput id={id} value={value} onChange={onChange} currency={false} suffix={suffix} />
    </Field>
  )
}
