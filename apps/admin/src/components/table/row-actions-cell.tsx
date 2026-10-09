'use client'

import { ArrowRight } from '@commerce/ui/icons'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type RowActionsCellProps = {
  /** Draws the "open" arrow that goes to the row's page. */
  href?: string | undefined
  /** The ⋯ menu (or any row-end controls). */
  children?: ReactNode
}

/**
 * The 64px row actions column (Figma "Table · Row"): open arrow and the ⋯ menu, quiet at 40%
 * and full strength when the row is hovered or a control inside has focus. The row needs the
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
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
      {children}
    </div>
  )
}
