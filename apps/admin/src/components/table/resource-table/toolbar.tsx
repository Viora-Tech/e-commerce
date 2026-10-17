'use client'

import { Plus, Search, SlidersHorizontal, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import type { ReactTable, RowData } from '@tanstack/react-table'
import { type ComponentProps, type ReactNode, useState } from 'react'
import CountBadge from '@/components/layout/count-badge'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'
import ColumnsMenu from './columns-menu'
import type { ResourceTableFeatures } from './features'
import SortMenu from './sort-menu'

export type AppliedFilter = {
  key: string
  label: string
  /** The group the value belongs to: the chip reads "<field> is <label>" (Figma applied filters). */
  field?: string | undefined
  onRemove: () => void
}

/** The filter popover's body; a function gets a `close` for a "Show results" button. */
export type FilterPanel = ReactNode | ((close: () => void) => ReactNode)

type ToolbarProps<T extends RowData> = {
  table: ReactTable<ResourceTableFeatures, T>
  plural: string
  query: string
  onQueryChange: (q: string) => void
  /** The "View" dropdown (Figma Table / View select), drawn first with a divider after it. */
  views?: ReactNode
  /** Filter controls (selects, date pickers) shown in the filter popover. */
  filters?: FilterPanel
  filtersClassName?: string | undefined
  applied?: AppliedFilter[]
  onClearAll?: () => void
  /** Human-readable column titles for the columns menu, by column id. */
  columnTitles: Record<string, string>
  /** The sort menu's names per column, and its order (Figma "State · Sort open"). */
  sortTitles: Record<string, string>
  sortOrder: string[]
  /** Direction words per column for the sort menu. */
  sortLabels: Record<string, { desc: string; asc: string }>
  /** The columns' order as the member arranged it (empty = as defined). */
  columnOrder: string[]
  /** The columns menu's Reset: the page's default columns and order. */
  onResetColumns: () => void
}

/* Figma "Table / Toolbar": the top row of the table card. View select, a divider, a borderless
   search that fills the row, then 32px ghost icon buttons (filter, sort, columns). */
const CONTROL =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-sm text-body font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted data-[popup-open]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0'

export default function ResourceTableToolbar<T extends RowData>({
  table,
  plural,
  query,
  onQueryChange,
  views,
  filters,
  filtersClassName,
  applied = [],
  onClearAll,
  columnTitles,
  sortTitles,
  sortOrder,
  sortLabels,
  columnOrder,
  onResetColumns,
}: ToolbarProps<T>) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Render logic
  const hideable = table.getAllColumns().filter((c) => c.getCanHide())
  const hasApplied = applied.length > 0 || query.length > 0

  return (
    <div className="flex flex-col border-border border-b">
      <div className="flex flex-wrap items-center gap-2 py-2 pr-2 pl-1.5">
        {views ? (
          <>
            {views}
            <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          </>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 transition-colors focus-within:bg-muted/50">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={tableCopy.search(plural)}
              aria-label={tableCopy.search(plural)}
              className="min-w-0 flex-1 bg-transparent text-[0.8125rem] leading-[1.1875rem] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          {filters ? (
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger
                render={<ToolbarButton className="min-w-8 px-2" aria-label={tableCopy.filter} />}
                nativeButton
              >
                <SlidersHorizontal />
                {applied.length > 0 ? <CountBadge n={applied.length} tone="inverse" /> : null}
              </PopoverTrigger>
              <PopoverContent align="end" className={filtersClassName ?? 'w-64'}>
                {typeof filters === 'function' ? filters(() => setFiltersOpen(false)) : filters}
              </PopoverContent>
            </Popover>
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
      {/* Figma "Applied filters": a row under the search, split by a hairline. Each chip is a
          pill reading "Payment is Unpaid" with a remove ×, then "Add filter" and "Clear all". */}
      {hasApplied && onClearAll ? (
        <div className="flex flex-wrap items-center gap-2 border-border border-t px-3 py-2.5">
          {applied.map((f) => (
            <span
              key={f.key}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-muted/60 pr-1 pl-2.5 text-xs text-foreground"
            >
              {f.field ? (
                <span className="text-muted-foreground">{tableCopy.filterIs(f.field)}</span>
              ) : null}
              <span className="font-medium">{f.label}</span>
              <button
                type="button"
                onClick={f.onRemove}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                aria-label={tableCopy.removeFilter(f.label)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {filters ? (
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-body font-medium text-foreground transition-colors hover:bg-muted [&_svg]:size-4"
            >
              <Plus aria-hidden="true" />
              {tableCopy.addFilter}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex h-7 items-center rounded-sm px-2 text-body font-medium text-foreground transition-colors hover:bg-muted"
          >
            {tableCopy.clearFilters}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ToolbarButton({ className, ...props }: ComponentProps<'button'>) {
  return <button type="button" className={cn(CONTROL, className)} {...props} />
}
