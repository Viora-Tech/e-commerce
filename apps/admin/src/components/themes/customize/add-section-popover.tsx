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
          <Button variant="ghost" size="sm" className="w-full justify-start text-primary">
            <Plus aria-hidden />
            {customizeContent.tree.add}
          </Button>
        }
      />
      <PopoverContent align="start" side="right" className="relative flex w-96 flex-col p-0">
        <AddSectionBrowser zone={zone} group={group} count={count} onAdd={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
