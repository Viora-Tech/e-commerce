'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useId } from 'react'
import type { ChecksGroup } from './types'

type ChecksSectionProps = { group: ChecksGroup }

/** Ticks or unticks one value, keeping the options' order. */
function toggle(group: ChecksGroup, value: string): string[] {
  const on = group.value.includes(value)
  return group.options
    .filter((o) => (o.value === value ? !on : group.value.includes(o.value)))
    .map((o) => o.value)
}

export default function ChecksSection({ group }: ChecksSectionProps) {
  // Hooks
  const id = useId()

  return (
    <div className="flex flex-col">
      {group.options.map((o) => (
        <div key={o.value} className="flex h-7 items-center gap-2.5">
          <Checkbox
            id={`${id}-${o.value}`}
            checked={group.value.includes(o.value)}
            onCheckedChange={() => group.onChange(toggle(group, o.value))}
          />
          <label htmlFor={`${id}-${o.value}`} className="cursor-pointer text-body text-foreground">
            {o.label}
          </label>
        </div>
      ))}
    </div>
  )
}
