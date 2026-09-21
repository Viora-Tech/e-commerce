'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import {
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { EmptyState } from '@/components/layout/empty-state'
import { tableContent } from '@/data/table'
import { defineColumns, type ResourceColumnSpec, selectionColumn } from './columns'
import { resourceTableFeatures } from './features'
import { ResourceTablePagination } from './pagination'
import { type AppliedFilter, ResourceTableToolbar } from './toolbar'

export type { AppliedFilter, ResourceColumnSpec }

type CellMeta = { align?: 'start' | 'end'; className?: string }

export type ResourceTableProps<T extends RowData> = {
  resourceName: { singular: string; plural: string }
  columns: ResourceColumnSpec<T>[]
  items: T[]
  getId: (item: T) => string
  /** Row click navigates here (and the row shows a pointer). */
  href?: (item: T) => string
  loading?: boolean
  query: string
  onQueryChange: (q: string) => void
  filters?: ReactNode
  applied?: AppliedFilter[]
  onClearAll?: () => void
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  selectable?: boolean
  /** Rendered in the selection bar; call `clear` after a bulk action. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode
  empty?: { heading: string; body?: string; action?: ReactNode }
}

const SKELETON_ROWS = 6

/**
 * The one table. Every admin list renders through this so search, filters,
 * selection, sorting, empty states and paging look and behave the same.
 * Paging and search are server-side; sorting and selection act on the loaded page.
 */
export function ResourceTable<T extends RowData>(props: ResourceTableProps<T>) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectable = props.selectable ?? true
  const columns = [...(selectable ? [selectionColumn<T>()] : []), ...defineColumns(props.columns)]
  const columnTitles = Object.fromEntries(props.columns.map((c) => [c.id, c.title]))

  const table = useTable({
    features: resourceTableFeatures,
    data: props.items,
    columns,
    getRowId: (row) => props.getId(row),
    enableRowSelection: selectable,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnVisibility, rowSelection },
  })

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const clearSelection = () => setRowSelection({})
  const rows = table.getRowModel().rows
  const visibleCount = table.getVisibleLeafColumns().length
  const isEmpty = !props.loading && props.items.length === 0

  return (
    <Card className="gap-0 px-5 py-5">
      <ResourceTableToolbar
        table={table}
        plural={props.resourceName.plural}
        query={props.query}
        onQueryChange={props.onQueryChange}
        filters={props.filters}
        applied={props.applied}
        onClearAll={props.onClearAll}
        columnTitles={columnTitles}
      />
      {selectedIds.length > 0 && props.bulkActions ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary-soft px-4 py-2 text-sm">
          <span className="font-medium">
            {tableContent.selected(
              selectedIds.length,
              props.resourceName.singular,
              props.resourceName.plural,
            )}
          </span>
          {props.bulkActions(selectedIds, clearSelection)}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSelection}>
            {tableContent.clearSelection}
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <Table className="border-separate border-spacing-0">
          <TableHeader className="sticky top-0 z-10 [&_tr]:border-0">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as CellMeta | undefined
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-12 bg-primary-soft px-5 text-table-head uppercase text-muted-foreground first:rounded-l-lg last:rounded-r-lg',
                        meta?.align === 'end' && 'text-right',
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {props.loading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <TableRow key={`skeleton-${i.toString()}`} className="hover:bg-transparent">
                    {Array.from({ length: visibleCount }, (_, j) => (
                      <TableCell
                        key={`skeleton-${i.toString()}-${j.toString()}`}
                        className="h-[54px] px-5"
                      >
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => {
                  const target = props.href?.(row.original)
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={cn(
                        'border-0 hover:bg-muted/60 data-[state=selected]:bg-primary-soft',
                        target && 'cursor-pointer',
                      )}
                      onClick={target ? () => router.push(target) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as CellMeta | undefined
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'h-[54px] border-b border-border-soft px-5 text-body',
                              meta?.align === 'end' && 'text-right',
                              meta?.className,
                            )}
                          >
                            <table.FlexRender cell={cell} />
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
          </TableBody>
        </Table>
        {isEmpty ? (
          <EmptyState
            heading={props.empty?.heading ?? tableContent.emptyHeading(props.resourceName.plural)}
            body={props.empty?.body ?? tableContent.emptyBody}
            action={props.empty?.action}
          />
        ) : null}
      </div>
      <ResourceTablePagination
        page={props.page}
        perPage={props.perPage}
        total={props.total}
        onPageChange={props.onPageChange}
      />
    </Card>
  )
}
