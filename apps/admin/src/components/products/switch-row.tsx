import { Field, FieldContent, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'

type SwitchRowProps = {
  id: string
  label: string
  help: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  /** An extra line under the help (the tax a price carries). */
  children?: ReactNode
}

/**
 * A setting on the product and variant pages: its label and help on the left, the switch on the
 * right. Drawn with the shared Field parts; the label keeps the body size of a toggle row.
 */
export default function SwitchRow({
  id,
  label,
  help,
  checked,
  onChange,
  children,
}: SwitchRowProps) {
  // Render logic
  return (
    <Field orientation="horizontal" className="items-start justify-between gap-4">
      <FieldContent>
        <FieldLabel htmlFor={id} className="text-body leading-5 font-normal text-foreground">
          {label}
        </FieldLabel>
        <FieldDescription>{help}</FieldDescription>
        {children}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}
