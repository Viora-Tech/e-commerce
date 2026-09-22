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
  createColumnHelper,
  type RowData,
  type RowSelectionState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { tableContent } from '@/data/table'
import { fast, instant } from '@/lib/motion'
import {
  type CellAlign,
  defineColumns,
  type ResourceColumn,
  type ResourceColumnSpec,
  selectionColumn,
} from './columns'
import { type ResourceTableFeatures, resourceTableFeatures } from './features'
import ResourceTablePagination from './pagination'
import { RESOURCE_TABLE_METRICS, type ResourceTableSize } from './sizes'
import ResourceTableToolbar, { type AppliedFilter } from './toolbar'

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
  /**
   * Per-row actions, drawn in a trailing cell. The cell's own controls must stop
   * propagation: a table with `href` navigates from a click anywhere in the row.
   */
  rowActions?: (item: T) => ReactNode
  /** `frame` draws Dealport 5:2560 at its own px; `compact` (default) is the density scale. */
  size?: ResourceTableSize
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
function tableColumns<T extends RowData>(props: ResourceTableProps<T>) {
  const selectable = props.selectable ?? true
  const offset = (props.page - 1) * props.perPage
  return [
    ...(selectable ? [selectionColumn<T>(offset)] : []),
    ...defineColumns(props.columns),
    ...(props.rowActions ? [actionsColumn<T>(props.rowActions)] : []),
  ]
}

/** The trailing actions column: unnamed, unsortable and never hidden by the View menu. */
function actionsColumn<T extends RowData>(render: (item: T) => ReactNode): ResourceColumn<T> {
  const helper = createColumnHelper<ResourceTableFeatures, T>()
  return helper.display({
    id: '__actions',
    header: () => null,
    cell: ({ row }) => render(row.original),
    enableSorting: false,
    enableHiding: false,
    meta: { align: 'end', className: 'w-16' },
  })
}

export default function ResourceTable<T extends RowData>(props: ResourceTableProps<T>) {
  // Hooks
  const router = useRouter()
  const reduced = useReducedMotion()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const table = useTable({
    features: resourceTableFeatures,
    data: props.items,
    columns: tableColumns(props),
    getRowId: (row) => props.getId(row),
    enableRowSelection: props.selectable ?? true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnVisibility, rowSelection },
  })

  // Helpers
  const clearSelection = () => setRowSelection({})

  // Render logic
  const columnTitles = Object.fromEntries(props.columns.map((c) => [c.id, c.title]))
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const rows = table.getRowModel().rows
  const visibleCount = table.getVisibleLeafColumns().length
  const isEmpty = !props.loading && props.items.length === 0
  const m = RESOURCE_TABLE_METRICS[props.size ?? 'compact']

  return (
    <Card className={cn('gap-0', m.card)}>
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
        size={props.size ?? 'compact'}
      />
      <AnimatePresence initial={false}>
        {selectedIds.length > 0 && props.bulkActions ? (
          <motion.div
            key="bulk"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={reduced ? instant : fast}
            className="overflow-hidden"
          >
            <div className={cn('flex items-center gap-3 rounded-lg bg-primary-soft', m.bulkBar)}>
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
          </motion.div>
        ) : null}
      </AnimatePresence>
      {/* 5:2590: table starts 40px under the toolbar. */}
      <div className={cn('overflow-x-auto', m.gapAfterToolbar)}>
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
                        'bg-primary-soft text-ink-strong',
                        m.head,
                        m.headText,
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
                        className={cn('border-b border-line', m.skeletonCell)}
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
                        'border-0 transition-[background-color,box-shadow] duration-150 ease-out hover:bg-muted/60 data-[state=selected]:bg-primary-soft/50 motion-reduce:transition-none',
                        target &&
                          'cursor-pointer hover:relative hover:z-[1] hover:shadow-card-hover',
                      )}
                      onClick={target ? () => router.push(target) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as CellMeta | undefined
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'border-b border-line text-foreground',
                              m.cell,
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
        size={props.size ?? 'compact'}
      />
    </Card>
  )
}
