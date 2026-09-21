'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Input } from '@commerce/ui/shadcn/input'
import type { ReactTable, RowData } from '@tanstack/react-table'
import { Search, Settings2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { tableContent } from '@/data/table'
import type { ResourceTableFeatures } from './features'

export type AppliedFilter = { key: string; label: string; onRemove: () => void }

type ToolbarProps<T extends RowData> = {
  table: ReactTable<ResourceTableFeatures, T>
  plural: string
  query: string
  onQueryChange: (q: string) => void
  /** Filter controls (selects, date pickers) rendered next to the search box. */
  filters?: ReactNode
  applied?: AppliedFilter[]
  onClearAll?: () => void
  /** Human-readable column titles for the View menu, by column id. */
  columnTitles: Record<string, string>
}

export function ResourceTableToolbar<T extends RowData>({
  table,
  plural,
  query,
  onQueryChange,
  filters,
  applied = [],
  onClearAll,
  columnTitles,
}: ToolbarProps<T>) {
  const hideable = table.getAllColumns().filter((c) => c.getCanHide())
  const hasApplied = applied.length > 0 || query.length > 0

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={tableContent.search(plural)}
            className="h-10 rounded-full bg-muted pl-9 shadow-none"
          />
        </div>
        {filters}
        {hasApplied && onClearAll ? (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            <X />
            {tableContent.clearFilters}
          </Button>
        ) : null}
        {hideable.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline" className="ml-auto h-8 rounded-lg px-3" />
              }
            >
              {tableContent.view}
              <Settings2 />
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
      {applied.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      ) : null}
    </div>
  )
}
