'use client'

import type { SectionGroup } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import AddSectionBrowser from './add-section-browser'

type AddSectionPopoverProps = {
  /** Puck zone the section lands in, at the end. */
  zone: string
  /** Header and footer groups only take their own sections. */
  group: SectionGroup | null
  count: number
}

/** The Sections tree's own "+ Add section" row: the shared Add browser, in a popover. */
export default function AddSectionPopover({ zone, group, count }: AddSectionPopoverProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Render logic
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="group/add h-8 w-full justify-start gap-2 rounded-lg pl-6 text-[0.8125rem] font-normal text-muted-foreground hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
          >
            <span className="flex size-5 items-center justify-center rounded-md border border-dashed border-border-strong group-hover/add:border-primary group-hover/add:text-primary">
              <Plus aria-hidden className="size-3" />
            </span>
            {customizeContent.tree.add}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        className="relative flex w-[22rem] flex-col gap-0 p-0"
      >
        <AddSectionBrowser zone={zone} group={group} count={count} onAdd={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
