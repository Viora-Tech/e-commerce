'use client'

import { cn } from '@commerce/ui/lib/utils'
import { TableRow } from '@commerce/ui/shadcn/table'
import { useRouter } from 'next/navigation'
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react'

type LinkRowProps = {
  children: ReactNode
  className?: string
  /**
   * The row's own page: a click anywhere on the row opens it (Ctrl/⌘-click in a new tab). The row
   * still needs its own link inside (the name) for the keyboard and screen readers.
   */
  href?: string
  /** For a row that drags (a sortable's node ref and transform). */
  ref?: Ref<HTMLTableRowElement>
  style?: CSSProperties
}

/** Controls inside a row that keep their own click (a menu, a switch, the name link itself). */
const OWN_CLICK = 'a, button, input, select, textarea, label, [role="menuitem"], [role="switch"]'

/**
 * A table body row that opens its own page from a click anywhere on it, like the main lists
 * (`resource-table`). Carries `group/row` so `RowActionsCell` can brighten on hover.
 */
export default function LinkRow({ children, className, href, ref, style }: LinkRowProps) {
  // Hooks
  const router = useRouter()

  // Event handlers
  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!href || e.defaultPrevented) return
    const target = e.target as HTMLElement
    if (target.closest(OWN_CLICK) || window.getSelection()?.toString()) return
    if (e.metaKey || e.ctrlKey) window.open(href, '_blank', 'noopener')
    else router.push(href)
  }

  return (
    <TableRow
      ref={ref}
      style={style}
      onClick={href ? handleClick : undefined}
      className={cn('group/row', href && 'cursor-pointer', className)}
    >
      {children}
    </TableRow>
  )
}
