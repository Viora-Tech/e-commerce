'use client'

import { SquareTerminal } from '@commerce/ui/icons'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { navigationContent } from '@/data/navigation'
import { openPalette } from '@/lib/palette-events'

/* Same 36px row as the nav, muted until hovered (Saleor's "Command menu ⌘K" row). */
const ROW =
  'flex h-9 w-full min-w-0 items-center gap-2 rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'

/** The rail's bottom row: the command menu with its ⌘K hint. */
export default function SidebarUtilities() {
  return (
    <div className="flex flex-col gap-0.5 px-3">
      <button type="button" onClick={openPalette} className={ROW}>
        <SquareTerminal strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
          {navigationContent.commandMenu}
        </span>
        <Kbd className="group-data-[collapsible=icon]:hidden">
          {navigationContent.search.shortcut}
        </Kbd>
      </button>
    </div>
  )
}
