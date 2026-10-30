'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import { useCopy, useFormat } from '@/hooks/use-copy'

type SelectionBarProps = {
  /** Rows ticked right now (on this page or, after "Select all", across every page). */
  count: number
  /** Rows the list's filters match, across every page. */
  total: number
  /** Every row on this page is ticked. */
  pageFull: boolean
  /** Ticks (`true`) or unticks every row on this page: the bar's own checkbox. */
  onTogglePage: (checked: boolean) => void
  plural: string
  singular: string
  /** Loads every matching id; absent when the page cannot select beyond itself. */
  onSelectAll?: (() => void) | undefined
  selectingAll: boolean
  /** The table shows only the ticked rows. */
  showSelected: boolean
  onShowSelectedChange: (show: boolean) => void
  /** The list's bulk actions: its main ones as buttons, the rest in a More menu. */
  actions?: ReactNode
  onClear: () => void
}

/**
 * Shopify-style bulk bar: while rows are ticked it takes the table's header row. The page
 * checkbox, "3 orders selected ▾" (select the page, select all N matching, clear), the list's
 * bulk actions, and "Show all selected". On a phone the actions scroll sideways in the row and
 * "Show all selected" moves into the selection menu.
 */
export default function SelectionBar({
  count,
  total,
  pageFull,
  onTogglePage,
  plural,
  singular,
  onSelectAll,
  selectingAll,
  showSelected,
  onShowSelectedChange,
  actions,
  onClear,
}: SelectionBarProps) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  const fmt = useFormat()

  // Render logic
  const everything = count >= total && total > 0
  const canTakeAll = !everything && onSelectAll !== undefined
  const showLabel = showSelected ? tableCopy.showAllRows : tableCopy.showSelected

  return (
    <div className="flex h-10 min-w-0 items-center gap-2 bg-card pr-3">
      {/* Sits where the header's own checkbox does (the 40px selection column). */}
      <span className="flex w-10 shrink-0 items-center pl-3">
        <Checkbox
          className="size-4"
          checked={pageFull}
          indeterminate={!pageFull}
          onCheckedChange={(value) => onTogglePage(!!value)}
          aria-label={tableCopy.selectAll}
        />
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" />}
          aria-label={tableCopy.selectionMenu}
          className="-ml-2 shrink-0 tabular-nums"
        >
          {selectingAll ? <Spinner className="size-3.5" /> : null}
          {everything
            ? tableCopy.allSelected(fmt.number(total), plural)
            : tableCopy.selected(count, singular, plural)}
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuItem disabled={pageFull} onClick={() => onTogglePage(true)}>
            {tableCopy.selectPage}
          </DropdownMenuItem>
          {canTakeAll ? (
            <DropdownMenuItem disabled={selectingAll} onClick={onSelectAll}>
              {tableCopy.selectAllMatching(fmt.number(total), plural)}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="sm:hidden"
            onClick={() => onShowSelectedChange(!showSelected)}
          >
            {showLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClear}>{tableCopy.clearAllSelected}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The vertical padding keeps the buttons' focus rings inside the scrolling strip. */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-0.5 py-1 *:shrink-0">
        {actions}
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={showSelected}
        onClick={() => onShowSelectedChange(!showSelected)}
        className={cn('shrink-0 max-sm:hidden', showSelected && 'bg-muted')}
      >
        {showLabel}
      </Button>
    </div>
  )
}
