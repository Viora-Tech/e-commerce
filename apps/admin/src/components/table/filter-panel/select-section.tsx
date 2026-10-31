'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useId } from 'react'
import type { SelectGroup } from './types'

type SelectSectionProps = { group: SelectGroup }

/**
 * One choice out of a list, drawn as the same tick list as the "checks" groups: ticking a row
 * replaces the choice, unticking it goes back to "any".
 */
export default function SelectSection({ group }: SelectSectionProps) {
  // Hooks
  const id = useId()

  // Event handlers
  const handleToggle = (value: string) => {
    group.onChange(group.value === value ? null : value)
  }

  return (
    <div className="flex flex-col" role="radiogroup" aria-label={group.label}>
      {group.options.map((o) => (
        <div key={o.value} className="flex h-7 items-center gap-2.5">
          <Checkbox
            id={`${id}-${o.value}`}
            checked={group.value === o.value}
            onCheckedChange={() => handleToggle(o.value)}
          />
          <label htmlFor={`${id}-${o.value}`} className="cursor-pointer text-body text-foreground">
            {o.label}
          </label>
        </div>
      ))}
    </div>
  )
}
