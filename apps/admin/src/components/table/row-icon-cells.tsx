'use client'

import type { LucideIcon } from '@commerce/ui/icons'
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

export type RowIconLink = {
  label: string
  icon: LucideIcon
  href: string
  /** Opens in a new tab (the storefront page, the record in a second tab). */
  newTab?: boolean
}

type RowIconCellsProps = {
  links?: RowIconLink[]
  /** Links behind a trailing kebab cell. */
  menu?: readonly MenuLink[]
}

/* After the Saleor Dashboard datagrid row-end cells (BSD-3): 44px squares at the row edge,
   each split from the next by a 1px vertical rule, a muted glyph that darkens on hover. */
const CELL =
  'flex size-11 shrink-0 items-center justify-center border-border border-l text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&_svg]:size-4'

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

/** Trailing icon cells for a ResourceTable row; clicks stay in the cell, not the row. */
export default function RowIconCells({ links = [], menu }: RowIconCellsProps) {
  // Hooks
  const tableCopy = useCopy(tableContent)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's click-to-open; the controls inside are real links and buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation of the inner controls never reaches the row.
    <div className="flex justify-end" onClick={stop}>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-label={l.label}
          title={l.label}
          className={CELL}
          {...(l.newTab ? { target: '_blank', rel: 'noreferrer' } : {})}
        >
          <l.icon aria-hidden="true" />
        </Link>
      ))}
      {menu && menu.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={tableCopy.more} className={CELL}>
            <MoreVertical aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {menu.map((it) => (
              <DropdownMenuItem key={it.href} render={<Link href={it.href} />}>
                {it.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
