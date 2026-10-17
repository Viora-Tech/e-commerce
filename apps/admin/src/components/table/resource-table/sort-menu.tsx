'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import type { ReactTable, RowData } from '@tanstack/react-table'
import type { ComponentProps } from 'react'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'
import type { ResourceTableFeatures } from './features'

type SortMenuProps<T extends RowData> = {
  table: ReactTable<ResourceTableFeatures, T>
  columnTitles: Record<string, string>
  /** Column ids in the order the menu lists them. */
  sortOrder: string[]
  /** Direction words per column ("Newest first" / "Oldest first" for a date). */
  sortLabels: Record<string, { desc: string; asc: string }>
  /** The toolbar's 32px icon-button trigger. */
  trigger: ComponentProps<'button'>['className']
}

/**
 * Figma "State · Sort open" (623:17678): "Sort by" with a radio dot per column, then the two
 * directions with their arrows ("↓ Newest first ✓", "↑ Oldest first"). Picking a column keeps
 * the direction; the icon stays lit while a sort applies.
 */
export default function SortMenu<T extends RowData>({
  table,
  columnTitles,
  sortOrder,
  sortLabels,
  trigger,
}: SortMenuProps<T>) {
  // Hooks
  const tableCopy = useCopy(tableContent)

  // Helpers
  const rank = (id: string) => {
    const at = sortOrder.indexOf(id)
    return at === -1 ? sortOrder.length : at
  }

  // Render logic
  const sortable = table
    .getAllColumns()
    .filter((c) => c.getCanSort())
    .sort((a, b) => rank(a.id) - rank(b.id))
  const sortedBy = sortable.find((c) => c.getIsSorted())
  const direction = sortedBy?.getIsSorted() || 'desc'
  const words = (sortedBy && sortLabels[sortedBy.id]) || {
    desc: tableCopy.sortDesc,
    asc: tableCopy.sortAsc,
  }

  if (sortable.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tableCopy.sort}
        className={cn(trigger, 'size-8', sortedBy && 'bg-muted text-foreground')}
      >
        <ArrowUpDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tableCopy.sortBy}</DropdownMenuLabel>
          {sortable.map((column) => {
            const on = column.id === sortedBy?.id
            return (
              <DropdownMenuItem
                key={column.id}
                closeOnClick={false}
                onClick={() => column.toggleSorting(direction === 'desc')}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full border',
                    on ? 'border-foreground' : 'border-input',
                  )}
                >
                  {on ? <span className="size-2 rounded-full bg-foreground" /> : null}
                </span>
                {columnTitles[column.id] ?? column.id}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {(['desc', 'asc'] as const).map((d) => {
          const on = sortedBy !== undefined && direction === d
          const Arrow = d === 'desc' ? ArrowDown : ArrowUp
          return (
            <DropdownMenuItem
              key={d}
              disabled={!sortedBy}
              onClick={() => sortedBy?.toggleSorting(d === 'desc')}
              className={cn(on ? 'bg-muted/60 text-foreground' : 'text-muted-foreground')}
            >
              <Arrow className="size-4" aria-hidden="true" />
              <span className="flex-1">{words[d]}</span>
              {on ? <CheckIcon className="size-4" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
