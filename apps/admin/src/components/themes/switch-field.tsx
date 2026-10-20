'use client'

import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useId } from 'react'

type SwitchFieldProps = {
  label: string
  help?: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** While a save is in flight. */
  disabled?: boolean
}

/** A setting that is on or off. */
export default function SwitchField({
  label,
  help,
  checked,
  onChange,
  disabled,
}: SwitchFieldProps) {
  // Hooks
  const id = useId()

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-body font-normal">
          {label}
        </Label>
        {help ? <p className="text-caption text-muted-foreground">{help}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
