import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import MoneyInput from '@/components/fields/money-input'

type RupeeFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  help?: string | undefined
}

/** A money field in rupees on an option's page; the text stays as typed so "12." survives. */
export default function RupeeField({ id, label, value, onChange, help }: RupeeFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <MoneyInput id={id} value={value} onChange={onChange} />
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}
