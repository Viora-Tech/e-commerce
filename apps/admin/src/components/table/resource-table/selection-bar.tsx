'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import { useCopy, useFormat } from '@/hooks/use-copy'

type SelectionBarProps = {
  /** Rows ticked right now (on this page or, after "Select all", across every page). */
  count: number
  /** Rows the list's filters match, across every page. */
  total: number
  /** Every row on this page is ticked: offer to take the rest of the list. */
  pageFull: boolean
  plural: string
  singular: string
  /** Loads every matching id; absent when the page cannot select beyond itself. */
  onSelectAll?: (() => void) | undefined
  selectingAll: boolean
  /** The page's bulk actions (Mark as ▾ …). */
  actions?: ReactNode
  onClear: () => void
}

/**
 * Shopify-style selection header: while rows are ticked it takes the table's header row.
 * "10 orders selected", then — once the whole page is ticked — "Select all 1,214 orders" on the
 * right, the bulk actions, and Clear.
 */
export default function SelectionBar({
  count,
  total,
  pageFull,
  plural,
  singular,
  onSelectAll,
  selectingAll,
  actions,
  onClear,
}: SelectionBarProps) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  const fmt = useFormat()

  // Render logic
  const everything = count >= total
  const canTakeAll = pageFull && !everything && onSelectAll !== undefined

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="text-body font-medium whitespace-nowrap text-ink-strong tabular-nums">
        {everything && total > 0
          ? tableCopy.allSelected(fmt.number(total), plural)
          : tableCopy.selected(count, singular, plural)}
      </span>
      {canTakeAll ? (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={selectingAll}
          className="inline-flex items-center gap-1.5 rounded-sm text-body font-medium whitespace-nowrap text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {selectingAll ? <Spinner className="size-3.5" /> : null}
          {tableCopy.selectAllMatching(fmt.number(total), plural)}
        </button>
      ) : null}
      <span className="flex-1" />
      {actions}
      <Button variant="ghost" size="sm" onClick={onClear}>
        {tableCopy.clearSelection}
      </Button>
    </div>
  )
}
