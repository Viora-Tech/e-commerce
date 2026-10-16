'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type RowActionsCellProps = {
  /** The row's page: the row itself opens it, so the link shows only to keyboard focus. */
  href?: string | undefined
  /** The ⋯ menu (or any row-end controls). */
  children?: ReactNode
}

/**
 * The row actions column (Figma "Table · Row"): the ⋯ menu, quiet at 40% and full strength
 * when the row is hovered or a control inside has focus. There is no open arrow (owner): the
 * whole row opens the page, and an "Open" link appears only when tabbed to. The row needs the
 * `group/row` class (ResourceTable's rows have it). Touch screens always show them in full.
 */
export default function RowActionsCell({ href, children }: RowActionsCellProps) {
  // Hooks
  const copy = useCopy(tableContent)

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-40 transition-opacity duration-150 ease-out group-hover/row:opacity-100 focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
      {href ? (
        <Link
          href={href}
          aria-label={copy.open}
          onClick={(e) => e.stopPropagation()}
          className="sr-only rounded-md px-2 py-1 text-xs font-medium text-foreground focus-visible:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copy.open}
        </Link>
      ) : null}
      {children}
    </div>
  )
}
