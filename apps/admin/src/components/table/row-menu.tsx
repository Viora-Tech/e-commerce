'use client'

import { MoreVertical } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

export type RowMenuItem = {
  label: string
  href?: string
  onSelect?: () => void
  destructive?: boolean
}

type RowMenuProps = { items: readonly RowMenuItem[] }

/** The ⋯ menu at the end of a table row; clicks stay in the menu and never open the row. */
export default function RowMenu({ items }: RowMenuProps) {
  // Hooks
  const copy = useCopy(tableContent)

  // Render logic
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={copy.more}
        onClick={(e) => e.stopPropagation()}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {items.map((it) => (
          <DropdownMenuItem
            key={it.label}
            className={cn(it.destructive && 'text-danger focus:text-danger')}
            onClick={it.onSelect}
            {...(it.href ? { render: <Link href={it.href} /> } : {})}
          >
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
