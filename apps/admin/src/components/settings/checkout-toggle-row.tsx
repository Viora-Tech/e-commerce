'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'

type CheckoutToggleRowProps = {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (on: boolean) => void
}

/** A yes/no checkout setting: label and hint on the left, switch on the right. */
export default function CheckoutToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: CheckoutToggleRowProps) {
  return (
    <Field orientation="horizontal" className="items-start justify-between">
      <div className="flex flex-col gap-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}
