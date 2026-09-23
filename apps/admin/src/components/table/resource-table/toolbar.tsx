'use client'

import { ArrowUpDown, Columns, Search, SlidersHorizontal, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import type { ReactTable, RowData } from '@tanstack/react-table'
import type { ComponentProps, ReactNode } from 'react'
import { tableContent } from '@/data/table'
import type { ResourceTableFeatures } from './features'

export type AppliedFilter = { key: string; label: string; onRemove: () => void }

type ToolbarProps<T extends RowData> = {
  table: ReactTable<ResourceTableFeatures, T>
  plural: string
  query: string
  onQueryChange: (q: string) => void
  tabs?: ReactNode
  /** Filter controls (selects, date pickers) shown in the filter popover. */
  filters?: ReactNode
  applied?: AppliedFilter[]
  onClearAll?: () => void
  /** Human-readable column titles for the columns menu, by column id. */
  columnTitles: Record<string, string>
}

/* Filter bar after the Saleor Dashboard list filters (BSD-3): 32px controls on hairlines,
   6px radius, search first, then Filters with its count, then sort and columns. */
const CONTROL =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-card text-body font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0'

export default function ResourceTableToolbar<T extends RowData>({
  table,
  plural,
  query,
  onQueryChange,
  tabs,
  filters,
  applied = [],
  onClearAll,
  columnTitles,
}: ToolbarProps<T>) {
  // Render logic
  const hideable = table.getAllColumns().filter((c) => c.getCanHide())
  const sortable = table.getAllColumns().filter((c) => c.getCanSort())
  const hasApplied = applied.length > 0 || query.length > 0

  return (
    <div className="flex flex-col">
      {tabs ? (
        <div className="no-scrollbar overflow-x-auto overflow-y-hidden border-b border-border px-4 md:px-6">
          {tabs}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <label className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25 hover:border-border-strong sm:w-72 lg:w-80">
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={tableContent.search(plural)}
            aria-label={tableContent.search(plural)}
            className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        {filters ? (
          <Popover>
            <PopoverTrigger render={<ToolbarButton className="px-2.5" />} nativeButton>
              <SlidersHorizontal strokeWidth={1.6} />
              {tableContent.filter}
              {applied.length > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-sm bg-foreground px-1 text-[0.6875rem] font-semibold text-background tabular-nums">
                  {applied.length}
                </span>
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              {filters}
            </PopoverContent>
          </Popover>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {sortable.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<ToolbarButton aria-label={tableContent.sort} className="size-8" />}
                nativeButton
              >
                <ArrowUpDown strokeWidth={1.6} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{tableContent.sort}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {sortable.map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                  >
                    {columnTitles[column.id] ?? column.id}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {hideable.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <ToolbarButton aria-label={tableContent.toggleColumns} className="size-8" />
                }
                nativeButton
              >
                <Columns strokeWidth={1.6} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{tableContent.toggleColumns}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {hideable.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {columnTitles[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      {hasApplied && onClearAll ? (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5 px-4 pb-3 md:px-6">
          {applied.map((f) => (
            <span
              key={f.key}
              className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-muted pr-0.5 pl-2 text-caption text-foreground"
            >
              {f.label}
              <button
                type="button"
                onClick={f.onRemove}
                className="flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                aria-label={tableContent.removeFilter(f.label)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {tableContent.clearFilters}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ToolbarButton({ className, ...props }: ComponentProps<'button'>) {
  return <button type="button" className={cn(CONTROL, className)} {...props} />
}
