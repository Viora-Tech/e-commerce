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
import { type CellAlign, defineColumns, type ResourceColumnSpec, selectionColumn } from './columns'
import { resourceTableFeatures } from './features'
import { ResourceTablePagination } from './pagination'
import { type AppliedFilter, ResourceTableToolbar } from './toolbar'

export type { AppliedFilter, ResourceColumnSpec }

type CellMeta = { align?: CellAlign; className?: string }

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
  /** Status tabs, rendered left of the toolbar as in frame 5:2561. */
  tabs?: ReactNode
  /** Filter controls rendered as a popover from the filter icon button. */
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

const ALIGN: Record<CellAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
}

/**
 * The one table, drawn to frame 5:2560: a 24px-padded card, tab group and
 * search row, a tinted header band, 68px rows on hairlines, numbered paging.
 * Paging and search are server-side; sorting and selection act on the loaded page.
 */
export function ResourceTable<T extends RowData>(props: ResourceTableProps<T>) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectable = props.selectable ?? true
  const offset = (props.page - 1) * props.perPage
  const columns = [
    ...(selectable ? [selectionColumn<T>(offset)] : []),
    ...defineColumns(props.columns),
  ]
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
    <Card className="gap-0 p-5">
      <ResourceTableToolbar
        table={table}
        plural={props.resourceName.plural}
        query={props.query}
        onQueryChange={props.onQueryChange}
        tabs={props.tabs}
        filters={props.filters}
        applied={props.applied}
        onClearAll={props.onClearAll}
        columnTitles={columnTitles}
      />
      {selectedIds.length > 0 && props.bulkActions ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-primary-soft px-4 py-2 text-body">
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
      {/* 5:2590: table starts 40px under the toolbar. */}
      <div className="mt-5 overflow-x-auto">
        <Table className="w-full table-fixed border-separate border-spacing-0">
          {/* 5:2591: header band, 8px inset, 6px radius, 40px cells. */}
          <TableHeader className="[&_tr]:border-0">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as CellMeta | undefined
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'h-10 bg-primary-soft px-2.5 py-1 text-table-head text-ink-strong first:rounded-l-[0.375rem] first:pl-4 last:rounded-r-[0.375rem] last:pr-4',
                        ALIGN[meta?.align ?? 'center'],
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
                        className="h-12 border-b border-line px-2.5"
                      >
                        <Skeleton className="mx-auto h-4 w-full max-w-32" />
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
                        'border-0 hover:bg-muted/60 data-[state=selected]:bg-primary-soft/50',
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
                              'h-12 border-b border-line px-2.5 py-2 text-body text-foreground first:pl-4 last:pr-4',
                              ALIGN[meta?.align ?? 'center'],
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
