'use client'

import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'

type SwitchRowProps = {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** Figma "Toggle row": a label and its one-line explanation, with the switch on the right. */
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
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="text-body font-medium">
          {label}
        </Label>
        {description ? <p className="text-caption text-muted-foreground">{description}</p> : null}
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
