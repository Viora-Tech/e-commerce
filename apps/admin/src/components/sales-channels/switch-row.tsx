'use client'

import { Field, FieldContent, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'

type SwitchRowProps = {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * Figma "Toggle row": a label and its one-line explanation, with the switch on the right. Drawn
 * with the shared Field parts; the label keeps the body size of a toggle row.
 */
export default function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: SwitchRowProps) {
  // Render logic
  return (
    <Field
      orientation="horizontal"
      className="justify-between gap-4 py-3 has-[>[data-slot=field-content]]:items-center"
    >
      <FieldContent>
        <FieldLabel htmlFor={id} className="text-body font-medium text-foreground">
          {label}
        </FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
    </Field>
  )
}
