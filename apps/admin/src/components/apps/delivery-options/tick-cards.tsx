'use client'

import { cn } from '@commerce/ui/lib/utils'

type TickCardsProps<V extends string> = {
  /** The radios' shared name: one set per page section. */
  name: string
  /** The id of the visible question that names the set. */
  labelledBy: string
  /** The ticked card; null ticks none (a setting no card stands for). */
  value: V | null
  items: ReadonlyArray<{ value: V; label: string; help: string }>
  onChange: (value: V) => void
}

/**
 * Big radio cards for one question (owner, 21 Nov 2026), as the Options page's "Courier list
 * (automatic) / Fixed options" picker: the whole card is the label, a real radio inside (so
 * arrow keys move between cards), a drawn ring with a dot, and one short help line.
 */
export default function TickCards<V extends string>({
  name,
  labelledBy,
  value,
  items,
  onChange,
}: TickCardsProps<V>) {
  return (
    <fieldset aria-labelledby={labelledBy} className="grid grid-cols-1 gap-2">
      {items.map((item) => {
        const on = value === item.value
        return (
          <label
            key={item.value}
            className={cn(
              'motion-press flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              on
                ? 'border-primary bg-primary-soft ring-1 ring-primary'
                : 'border-panel-border bg-card hover:bg-row-hover',
            )}
          >
            <input
              type="radio"
              name={name}
              value={item.value}
              checked={on}
              onChange={() => onChange(item.value)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border-2',
                on ? 'border-primary' : 'border-muted-foreground/60',
              )}
            >
              {on ? <span className="size-2 rounded-full bg-primary" /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body font-medium text-ink-strong">{item.label}</span>
              <span className="text-caption text-muted-foreground">{item.help}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
