'use client'

import type { SectionGroup } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import AddSectionBrowser from './add-section-browser'

type AddSectionPopoverProps = {
  /** Puck zone the section lands in. */
  zone: string
  /** Header and footer groups only take their own sections. */
  group: SectionGroup | null
  /** Position in the zone the new section takes. */
  index: number
  count: number
  /**
   * `row` is the "+ Add section" row closing each group; `line` is the thin
   * insert line between two rows, which only shows on hover or focus.
   */
  variant?: 'row' | 'line'
}

const copy = customizeContent.tree

/** The Sections tree's "+" points: the shared Add browser in a popover, inserting at `index`. */
export default function AddSectionPopover({
  zone,
  group,
  index,
  count,
  variant = 'row',
}: AddSectionPopoverProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Render logic
  const trigger =
    variant === 'line' ? (
      <button
        type="button"
        aria-label={copy.insertHere}
        title={copy.insertHere}
        className={cn(
          // A 0.5rem band straddling the gap above a row: the line and its "+"
          // fade in while the pointer is in the band or the popover is open.
          'group/insert absolute inset-x-1 -top-[0.3125rem] z-20 flex h-2 items-center outline-none',
          'focus-visible:[&>*]:opacity-100 data-[popup-open]:[&>*]:opacity-100 hover:[&>*]:opacity-100',
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity duration-150 motion-reduce:transition-none">
          <Plus aria-hidden className="size-2.5" />
        </span>
        <span className="h-0.5 flex-1 rounded-full bg-primary opacity-0 transition-opacity duration-150 motion-reduce:transition-none" />
      </button>
    ) : (
      <Button
        variant="ghost"
        size="sm"
        className="group/add h-8 w-full justify-start gap-2 rounded-lg pl-6 text-[0.8125rem] font-normal text-muted-foreground hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
      >
        <span className="flex size-5 items-center justify-center rounded-md border border-dashed border-border-strong transition-colors duration-150 group-hover/add:border-primary group-hover/add:text-primary">
          <Plus aria-hidden className="size-3" />
        </span>
        {copy.add}
      </Button>
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        className="relative flex w-[22rem] flex-col gap-0 p-0"
      >
        <AddSectionBrowser
          zone={zone}
          group={group}
          index={index}
          count={count}
          onAdd={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
