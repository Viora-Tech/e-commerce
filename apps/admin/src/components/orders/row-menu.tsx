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
      <DropdownMenuContent align="end" className="w-56">
        {items.map((it) => (
          <DropdownMenuItem
            key={`${it.href}${it.newTab ? ':tab' : ''}`}
            render={
              it.newTab ? (
                // biome-ignore lint/a11y/useAnchorContent: the menu item renders the label inside.
                <a href={it.href} target="_blank" rel="noreferrer" />
              ) : (
                <Link href={it.href} />
              )
            }
          >
            {it.icon ? <it.icon className="size-4 text-muted-foreground" aria-hidden /> : null}
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
