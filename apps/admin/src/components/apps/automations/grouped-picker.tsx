'use client'

import type { IconComponent } from '@commerce/ui/icons'
import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { type ReactNode, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'

export type PickerItem = {
  id: string
  label: string
  hint?: string | undefined
  icon?: IconComponent | undefined
  /** Small chips after the label: "Bigger plan", "Asks first"… */
  badges?: ReactNode
  disabled?: boolean | undefined
}

export type PickerGroup = { id: string; label: string; items: PickerItem[] }

type GroupedPickerProps = {
  groups: PickerGroup[]
  searchLabel: string
  emptyLabel: string
  onPick: (id: string) => void
}

const matches = (item: PickerItem, q: string) =>
  !q || `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(q)

/** A search field over grouped options (Flow's step picker): type to filter, click or Enter to pick. */
export default function GroupedPicker({
  groups,
  searchLabel,
  emptyLabel,
  onPick,
}: GroupedPickerProps) {
  // Hooks
  const [query, setQuery] = useState('')

  // Event handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const first = shown.flatMap((g) => g.items).find((i) => !i.disabled)
    if (first) {
      e.preventDefault()
      onPick(first.id)
    }
  }

  // Render logic
  const q = query.trim().toLowerCase()
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => matches(i, q)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          size="lg"
          className="pl-9"
          value={query}
          aria-label={searchLabel}
          placeholder={searchLabel}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="-mx-2 max-h-[26rem] min-h-[8rem] overflow-y-auto overscroll-contain">
        {shown.length === 0 ? (
          <EmptyState variant="plain" size="lg" className="px-2" body={emptyLabel} />
        ) : (
          shown.map((g) => (
            <section key={g.id} aria-label={g.label} className="flex flex-col pb-2">
              <h3 className="px-2 pt-2 pb-1 text-eyebrow text-muted-foreground">{g.label}</h3>
              <ul className="flex flex-col">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => onPick(item.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
                      )}
                    >
                      {item.icon ? (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card [&_svg]:size-4">
                          <item.icon aria-hidden="true" />
                        </span>
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 text-body font-medium text-foreground">
                          {item.label}
                          {item.badges}
                        </span>
                        {item.hint ? (
                          <span className="text-caption text-muted-foreground">{item.hint}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
