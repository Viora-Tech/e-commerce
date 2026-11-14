'use client'

import { Search, SlidersHorizontal } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactTable, RowData } from '@tanstack/react-table'
import { type ReactNode, useState } from 'react'
import {
  chipGroups,
  clearGroups,
  type FilterGroup,
  hasFilter,
} from '@/components/table/filter-panel'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'
import ColumnsMenu from './columns-menu'
import type { ResourceTableFeatures } from './features'
import FilterChip from './filter-chip'
import FilterMenu from './filter-menu'
import SortMenu from './sort-menu'
import { CONTROL_HEIGHT, TOOLBAR_ROW } from './styles'

export type AppliedFilter = {
  key: string
  label: string
  /** The group the value belongs to: the chip reads "<field> is <label>" (Figma applied filters). */
  field?: string | undefined
  /** The chip reads "<field> is not <label>" (a picker's Is not). */
  negated?: boolean | undefined
  onRemove: () => void
}

type ToolbarProps<T extends RowData> = {
  table: ReactTable<ResourceTableFeatures, T>
  plural: string
  query: string
  onQueryChange: (q: string) => void
  /** The "View" dropdown (Figma Table / View select), drawn first with a divider after it. */
  views?: ReactNode
  /** The list's filters: picked from the Filter menu, each shown as a chip with its own popover. */
  filterGroups?: FilterGroup[] | undefined
  /** Human-readable column titles for the columns menu, by column id. */
  columnTitles: Record<string, string>
  /** The sort menu's names per column, and its order (Figma "State · Sort open"). */
  sortTitles: Record<string, string>
  sortOrder: string[]
  /** Direction words per column for the sort menu. */
  sortLabels: Record<string, { desc: string; asc: string; first?: 'asc' | 'desc' | undefined }>
  /** The columns' order as the member arranged it (empty = as defined). */
  columnOrder: string[]
  /** The columns menu's Reset: the page's default columns and order. */
  onResetColumns: () => void
}

/* Figma "Table / Toolbar": the top row of the table card. View select, a divider, a borderless
   search that fills the row, then ghost buttons (filter, sort, columns), all 2.25rem tall like
   every other control. */
const CONTROL = cn(
  CONTROL_HEIGHT,
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm text-body font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted data-[popup-open]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0',
)

export default function ResourceTableToolbar<T extends RowData>({
  table,
  plural,
  query,
  onQueryChange,
  views,
  filterGroups = [],
  columnTitles,
  sortTitles,
  sortOrder,
  sortLabels,
  columnOrder,
  onResetColumns,
}: ToolbarProps<T>) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  // The chip whose popover is open; a filter just picked from the menu shows while still empty.
  const [openKey, setOpenKey] = useState<string | null>(null)

  // Event handlers
  const handleChipOpen = (key: string, open: boolean) => setOpenKey(open ? key : null)

  // Render logic
  const hideable = table.getAllColumns().filter((c) => c.getCanHide())
  const chips = chipGroups(filterGroups, openKey)
  const appliedCount = chips.filter(hasFilter).length

  return (
    <div className="flex flex-col border-border border-b">
      <div className={TOOLBAR_ROW}>
        {views ? (
          <>
            {views}
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          </>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* One "Search and filter" bar, as Shopify does it: the applied filters sit inside it as
              pills ("Payment is Paid ×") before the text, not in a second row under it. A pill
              reopens its own small popover; the Filter button adds another. */}
          <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-sm px-2 py-0.5 transition-colors focus-within:bg-muted/50">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            {chips.map((g) => (
              <FilterChip
                key={g.key}
                group={g}
                open={openKey === g.key}
                onOpenChange={(open) => handleChipOpen(g.key, open)}
              />
            ))}
            {appliedCount >= 2 ? (
              <button
                type="button"
                onClick={() => clearGroups(filterGroups)}
                className="inline-flex h-7 shrink-0 items-center rounded-sm px-1.5 text-body font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {tableCopy.clearFilters}
              </button>
            ) : null}
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={chips.length > 0 ? tableCopy.searchMore : tableCopy.search(plural)}
              aria-label={tableCopy.search(plural)}
              className="h-7 min-w-32 flex-1 bg-transparent text-caption font-normal text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          {filterGroups.length > 0 ? (
            <FilterMenu
              groups={filterGroups}
              onPick={setOpenKey}
              className={cn(CONTROL, 'min-w-9 px-2')}
              label={tableCopy.filter}
            >
              <SlidersHorizontal />
              <span className="hidden sm:inline">{tableCopy.filter}</span>
            </FilterMenu>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <SortMenu
              table={table}
              columnTitles={sortTitles}
              sortOrder={sortOrder}
              sortLabels={sortLabels}
              trigger={CONTROL}
            />
            {hideable.length > 0 ? (
              <ColumnsMenu
                table={table}
                columnTitles={columnTitles}
                columnOrder={columnOrder}
                onReset={onResetColumns}
                trigger={CONTROL}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
