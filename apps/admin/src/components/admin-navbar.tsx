'use client'

import { ModeToggle } from '@commerce/ui/global/mode-toggle'
import { Separator } from '@commerce/ui/shadcn/separator'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'

export function AdminNavbar({ storeName }: { storeName: string | null }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <span className="text-sm text-muted-foreground">{storeName ?? 'No store selected'}</span>
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
      </div>
    </header>
  )
}
