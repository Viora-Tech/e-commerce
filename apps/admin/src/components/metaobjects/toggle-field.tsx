'use client'

import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'

type ToggleFieldProps = {
  id: string
  label: string
  help?: string | undefined
  checked: boolean
  disabled?: boolean | undefined
  onChange: (checked: boolean) => void
}

/** A switch with its label and a line of help underneath. */
export default function ToggleField({
  id,
  label,
  help,
  checked,
  disabled,
  onChange,
}: ToggleFieldProps) {
  // Render logic
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="text-body-strong">
          {label}
        </Label>
        {help ? <p className="text-caption text-muted-foreground">{help}</p> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
    </div>
  )
}
