'use client'

import { Field, FieldContent, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroupItem } from '@commerce/ui/shadcn/radio-group'

type RadioOptionProps = {
  id: string
  value: string
  label: string
  help?: string | undefined
}

/**
 * One plain radio row (radio, then its label, optional help under it), the way every admin
 * radio list draws it. The label sits beside the radio, not around it, so it never takes the
 * checked tint shadcn gives a wrapping `FieldLabel`.
 */
export default function RadioOption({ id, value, label, help }: RadioOptionProps) {
  return (
    <Field orientation="horizontal" className={help ? 'items-start' : undefined}>
      <RadioGroupItem id={id} value={value} className={help ? 'mt-0.5' : undefined} />
      <FieldContent className="gap-0.5">
        <FieldLabel htmlFor={id} className="text-body font-normal">
          {label}
        </FieldLabel>
        {help ? <FieldDescription>{help}</FieldDescription> : null}
      </FieldContent>
    </Field>
  )
}
