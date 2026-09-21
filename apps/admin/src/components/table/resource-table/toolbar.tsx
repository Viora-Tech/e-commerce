'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import type { ReactTable, RowData } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Search, SlidersHorizontal, X } from 'lucide-react'
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

/* 5:2576: 40px square, white, Neutal/300 hairline, 4px radius, 20px glyph. */
const ICON_BUTTON =
  'flex size-10 shrink-0 items-center justify-center rounded-[4px] border border-line bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5'

function IconButton({ className, ...props }: ComponentProps<'button'>) {
  return <button type="button" className={cn(ICON_BUTTON, className)} {...props} />
}

export function ResourceTableToolbar<T extends RowData>({
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
  const hideable = table.getAllColumns().filter((c) => c.getCanHide())
  const sortable = table.getAllColumns().filter((c) => c.getCanSort())
  const hasApplied = applied.length > 0 || query.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">{tabs}</div>
        {/* 5:2571: search 264 x 40 then icon buttons, 12px apart. */}
        <div className="flex items-center gap-3">
          <label className="flex h-10 w-[264px] items-center gap-1.5 rounded-lg bg-background py-1.5 pr-2 pl-3 focus-within:ring-2 focus-within:ring-ring">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={tableContent.search(plural)}
              className="min-w-0 flex-1 bg-transparent text-[14px] leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Search className="size-6 shrink-0 text-foreground" strokeWidth={1.6} />
          </label>
          {filters ? (
            <Popover>
              <PopoverTrigger render={<IconButton aria-label={tableContent.filter} />} nativeButton>
                <SlidersHorizontal />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                {filters}
              </PopoverContent>
            </Popover>
          ) : null}
          {sortable.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<IconButton aria-label={tableContent.sort} />}
                nativeButton
              >
                <ArrowUpDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{tableContent.sort}</DropdownMenuLabel>
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
                render={<IconButton aria-label={tableContent.more} />}
                nativeButton
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>{tableContent.toggleColumns}</DropdownMenuLabel>
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
        <div className="flex flex-wrap items-center gap-1.5">
          {applied.map((f) => (
            <Badge key={f.key} variant="secondary" className="h-6 gap-1 pr-1">
              {f.label}
              <button
                type="button"
                onClick={f.onRemove}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove ${f.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-[14px] text-muted-foreground hover:text-foreground"
          >
            {tableContent.clearFilters}
          </button>
        </div>
      ) : null}
    </div>
  )
}
