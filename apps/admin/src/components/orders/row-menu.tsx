'use client'

import { MoreVertical } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import type { MenuLink } from '@/components/layout/card-menu'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type RowMenuProps = {
  items: readonly MenuLink[]
}

/** The ⋯ menu in a row's actions column; clicks stay in the menu and never open the row. */
export default function RowMenu({ items }: RowMenuProps) {
  // Hooks
  const tableCopy = useCopy(tableContent)

  // Early returns
  if (items.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tableCopy.more}
        onClick={(e) => e.stopPropagation()}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((it) => (
          <DropdownMenuItem key={it.href} render={<Link href={it.href} />}>
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
