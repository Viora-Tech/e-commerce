'use client'

import { Search } from '@commerce/ui/icons'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { navigationContent } from '@/data/navigation'
import { openPalette } from '@/lib/palette-events'

type TopBarProps = {
  /** The section name, shown only on phones where the rail is folded away. */
  title: string
}

/**
 * Phones only. Like the Saleor Dashboard, the desktop admin has no top bar: the page header
 * is the top of the content and search, notifications, theme and account live in the rail.
 * On a phone this slim bar opens the rail and the command palette.
 */
export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-border border-b bg-sidebar px-2 md:hidden">
      <SidebarTrigger aria-label={navigationContent.openMenu} />
      <p className="min-w-0 flex-1 truncate text-body-strong text-foreground">{title}</p>
      <button
        type="button"
        onClick={openPalette}
        aria-label={navigationContent.search.placeholder}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <Search className="size-4" />
      </button>
    </header>
  )
}
