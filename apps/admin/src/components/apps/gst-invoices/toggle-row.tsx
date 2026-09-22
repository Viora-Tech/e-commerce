'use client'

import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'

type ToggleRowProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** A label with a switch on the right. */
export default function ToggleRow({ id, label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-body font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  )
}
