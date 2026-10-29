'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { useId, useState } from 'react'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import type { MultiGroup } from './types'

type MultiSectionProps = { group: MultiGroup }

/** Ticks or unticks one value, keeping the options' order so the URL never reorders. */
function toggle(group: MultiGroup, value: string): string[] {
  const on = group.value.includes(value)
  return group.options
    .filter((o) => (o.value === value ? !on : group.value.includes(o.value)))
    .map((o) => o.value)
}

/**
 * A long list (vendors, tags, states) with a search box: the ticked values stay on top, the rest
 * narrow as the merchant types. Each tick applies at once, like the other groups.
 */
export default function MultiSection({ group }: MultiSectionProps) {
  // Hooks
  const id = useId()
  const copy = useCopy(filterPanelContent)
  const [query, setQuery] = useState('')

  // Derived state
  const q = query.trim().toLowerCase()
  const ticked = group.options.filter((o) => group.value.includes(o.value))
  const rest = group.options.filter(
    (o) => !group.value.includes(o.value) && (!q || o.label.toLowerCase().includes(q)),
  )
  const shown = [...ticked, ...rest]

  return (
    <div className="flex flex-col gap-1.5">
      {group.options.length > 6 ? (
        <Input
          type="search"
          aria-label={`${group.label}: ${copy.search}`}
          placeholder={group.searchPlaceholder ?? copy.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
      <div className="flex max-h-44 flex-col overflow-y-auto">
        {shown.length === 0 ? (
          <p className="py-1 text-body text-muted-foreground">{copy.noMatches}</p>
        ) : (
          shown.map((o) => (
            <div key={o.value} className="flex min-h-7 items-center gap-2.5">
              <Checkbox
                id={`${id}-${o.value}`}
                checked={group.value.includes(o.value)}
                onCheckedChange={() => group.onChange(toggle(group, o.value))}
              />
              <label
                htmlFor={`${id}-${o.value}`}
                className="min-w-0 cursor-pointer truncate text-body text-foreground"
              >
                {o.label}
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
