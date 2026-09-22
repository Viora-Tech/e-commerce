'use client'

import { cn } from '@commerce/ui/lib/utils'

type KitWeekToggleProps<T extends string> = {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}

/** Sheet 14:369 period toggle: Aqua Spring track (radius 12, 4px inset); the active option is a white radius-8 tab with 12/500 green text. */
export default function KitWeekToggle<T extends string>({
  options,
  value,
  onChange,
}: KitWeekToggleProps<T>) {
  // Render logic
  return (
    <div role="tablist" className="flex items-start gap-1 rounded-xl bg-primary-soft p-1">
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-lg px-3 py-2 text-kit-mini leading-[0.875rem] transition-colors',
              active
                ? 'bg-card font-medium text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
