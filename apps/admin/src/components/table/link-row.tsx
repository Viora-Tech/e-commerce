'use client'

import { cn } from '@commerce/ui/lib/utils'
import { TableRow } from '@commerce/ui/shadcn/table'
import { useRouter } from 'next/navigation'
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react'
import { openRow } from './open-row'

type LinkRowProps = {
  children: ReactNode
  className?: string
  /**
   * The row's own page: a click anywhere on the row opens it (middle, Ctrl/⌘ or Shift-click in a
   * new tab). The row
   * still needs its own link inside (the name) for the keyboard and screen readers.
   */
  href?: string
  /** For a row that drags (a sortable's node ref and transform). */
  ref?: Ref<HTMLTableRowElement>
  style?: CSSProperties
}

/**
 * A table body row that opens its own page from a click anywhere on it, like the main lists
 * (`resource-table`). Carries `group/row` so `RowActionsCell` can brighten on hover.
 */
export default function LinkRow({ children, className, href, ref, style }: LinkRowProps) {
  // Hooks
  const router = useRouter()

  // Event handlers
  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (href) openRow(e, href, (to) => router.push(to))
  }

  return (
    <TableRow
      ref={ref}
      style={style}
      onClick={href ? handleClick : undefined}
      onAuxClick={href ? handleClick : undefined}
      className={cn('group/row', href && 'cursor-pointer', className)}
    >
      {children}
    </TableRow>
  )
}
