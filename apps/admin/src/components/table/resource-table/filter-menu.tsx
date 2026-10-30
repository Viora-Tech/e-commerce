'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { type ReactNode, useRef, useState } from 'react'
import { type FilterGroup, hasFilter } from '@/components/table/filter-panel'

type FilterMenuProps = {
  groups: FilterGroup[]
  /** A filter was picked: the toolbar opens its chip. */
  onPick: (key: string) => void
  /** The trigger button's classes and content ("Filter" in the toolbar, "Add filter" by the chips). */
  className: string
  label: string
  children: ReactNode
}

/** The short list of filter names; picking one opens that filter's own chip popover. */
export default function FilterMenu({
  groups,
  onPick,
  className,
  label,
  children,
}: FilterMenuProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  // Picking a filter hands focus to its chip's popover, so the menu must not pull it back.
  const picked = useRef(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) picked.current = false
    setOpen(next)
  }

  const handlePick = (key: string) => {
    picked.current = true
    setOpen(false)
    onPick(key)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<button type="button" className={className} aria-label={label} />}
        nativeButton
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(24rem,var(--available-height))] w-56 gap-0 overflow-y-auto p-1"
        finalFocus={() => !picked.current}
      >
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => handlePick(g.key)}
            className="flex h-8 w-full shrink-0 items-center justify-between gap-2 rounded-sm px-2 text-left text-body text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="truncate">{g.label}</span>
            {hasFilter(g) ? (
              <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
