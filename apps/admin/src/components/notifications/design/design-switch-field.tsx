'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'

type DesignSwitchFieldProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** An on/off setting of a block ("Show social links"). */
export default function DesignSwitchField({
  id,
  label,
  checked,
  onChange,
}: DesignSwitchFieldProps) {
  // Render logic
  return (
    <Field orientation="horizontal" className="items-center justify-between">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}
