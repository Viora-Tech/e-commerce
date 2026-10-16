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
  type Updater,
  useTable,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import FloatingBar from '@/components/layout/floating-bar'
import RowActionsCell from '@/components/table/row-actions-cell'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'
import {
  type CellAlign,
  defineColumns,
  type ResourceColumn,
  type ResourceColumnSpec,
  selectionColumn,
} from './columns'
import { type ResourceTableFeatures, resourceTableFeatures } from './features'
import ResourceTablePagination from './pagination'
import ResourceTableToolbar, { type AppliedFilter, type FilterPanel } from './toolbar'

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
  /** The "View" dropdown (Figma Table / View select): a status picker drawn first in the toolbar. */
  views?: ReactNode
  /** Filter controls rendered as a popover from the filter icon button. */
  filters?: FilterPanel
  /** Size and padding of the filter popover (default: 16rem, padded). */
  filtersClassName?: string | undefined
  applied?: AppliedFilter[]
  onClearAll?: () => void
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  /** Shows the rows-per-page select (10 / 25 / 50 / 100) in the footer. */
  onPerPageChange?: (perPage: number) => void
  selectable?: boolean
  /**
   * Controlled selection, for a page whose own buttons act on the selected rows (Shipments'
   * "Book selected"). Without it the table keeps the selection itself.
   */
  selection?: { ids: string[]; onChange: (ids: string[]) => void }
  /** Rendered in the selection bar; call `clear` after a bulk action. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode
  empty?: { heading: string; body?: string; action?: ReactNode }
  /**
   * Per-row actions, drawn in a trailing cell. The cell's own controls must stop
   * propagation: a table with `href` navigates from a click anywhere in the row.
   */
  rowActions?: (item: T) => ReactNode
  /**
   * Row-end icon cells (Saleor datagrid): square icon buttons flush to the row edge, split by
   * vertical dividers. Use `RowIconCells` for the content; the value is how many cells it draws.
   */
  rowIconCells?: { count: 1 | 2 | 3; render: (item: T) => ReactNode }
  /** Kept for older call sites; every table now uses the one Saleor-style density. */
  size?: 'compact' | 'frame'
}

const SKELETON_ROWS = 6

/** The table's row selection: the page's own (`selection`) when given, else kept here. */
function useRowSelection(
  controlled: { ids: string[]; onChange: (ids: string[]) => void } | undefined,
) {
  const [own, setOwn] = useState<RowSelectionState>({})
  const value: RowSelectionState = controlled
    ? Object.fromEntries(controlled.ids.map((id) => [id, true]))
    : own
  const set = (next: Updater<RowSelectionState>) => {
    const resolved = typeof next === 'function' ? next(value) : next
    if (controlled) controlled.onChange(Object.keys(resolved).filter((id) => resolved[id]))
    else setOwn(resolved)
  }
  return [value, set] as const
}

/* Icon cells are 44px squares (the row height); the column drops its padding so the
   dividers run the full row height. */
const ICON_CELL_WIDTH = {
  1: 'w-11 p-0 last:pr-0 md:last:pr-0',
  2: 'w-22 p-0 last:pr-0 md:last:pr-0',
  3: 'w-33 p-0 last:pr-0 md:last:pr-0',
} as const

/* The row actions column: the ⋯ menu (no open arrow; the row opens the page). */
const ACTIONS_WIDTH = 'w-11 p-0 last:pr-2 md:last:pr-2'

const ALIGN: Record<CellAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
}

/* Proofly table (Figma "Table · Header / Row"): 40px header with small muted labels, 48px rows on
   thin dividers, cells inset to the page gutter. */
/* Figma "Table / Cell": header 40px, 12/16 regular muted; rows 60px; 12px sides; rows split by
   the border colour. */
const HEAD =
  'h-10 bg-transparent px-3 py-0 text-xs font-normal text-muted-foreground first:pl-3 last:pr-3'
const CELL = 'h-15 border-t border-border px-3 py-1.5 text-body first:pl-3 last:pr-3'

/**
 * The one table: a hairline card holding the filter bar, the grid and the pager.
 * Paging and search are server-side; sorting and selection act on the loaded page.
 */
function tableColumns<T extends RowData>(props: ResourceTableProps<T>) {
  const selectable = props.selectable ?? true
  return [
    ...(selectable ? [selectionColumn<T>()] : []),
    ...defineColumns(props.columns),
    ...(props.rowActions || props.href
      ? [actionsColumn<T>(props.rowActions, props.href, ACTIONS_WIDTH)]
      : []),
    ...(props.rowIconCells
      ? [
          actionsColumn<T>(
            props.rowIconCells.render,
            undefined,
            ICON_CELL_WIDTH[props.rowIconCells.count],
          ),
        ]
      : []),
  ]
}

/** The trailing actions column: unnamed, unsortable and never hidden by the View menu. */
function actionsColumn<T extends RowData>(
  render: ((item: T) => ReactNode) | undefined,
  href: ((item: T) => string) | undefined,
  className: string,
): ResourceColumn<T> {
  const helper = createColumnHelper<ResourceTableFeatures, T>()
  return helper.display({
    id: '__actions',
    header: () => null,
    cell: ({ row }) =>
      className === ACTIONS_WIDTH ? (
        <RowActionsCell href={href?.(row.original)}>{render?.(row.original)}</RowActionsCell>
      ) : (
        render?.(row.original)
      ),
    enableSorting: false,
    enableHiding: false,
    meta: { align: 'end', className },
  })
}

export default function ResourceTable<T extends RowData>(props: ResourceTableProps<T>) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = useRowSelection(props.selection)
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

  return (
    <Card gap="none" inset="y-none" className="overflow-hidden">
      <ResourceTableToolbar
        table={table}
        plural={props.resourceName.plural}
        query={props.query}
        onQueryChange={props.onQueryChange}
        tabs={props.tabs}
        views={props.views}
        filters={props.filters}
        filtersClassName={props.filtersClassName}
        applied={props.applied}
        onClearAll={props.onClearAll}
        columnTitles={columnTitles}
      />
      <div className="no-scrollbar overflow-x-auto">
        <Table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0">
          <TableHeader className="[&_tr]:border-0">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as CellMeta | undefined
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(HEAD, ALIGN[meta?.align ?? 'start'], meta?.className)}
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
                      <TableCell key={`skeleton-${i.toString()}-${j.toString()}`} className={CELL}>
                        <Skeleton className={cn('h-3.5', j === 0 ? 'w-4' : 'w-full max-w-32')} />
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
                        'group/row border-0 tabular-nums transition-colors duration-150 hover:bg-row-hover data-[state=selected]:bg-primary-soft motion-reduce:transition-none',
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
                              CELL,
                              'text-foreground',
                              ALIGN[meta?.align ?? 'start'],
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
            heading={props.empty?.heading ?? tableCopy.emptyHeading(props.resourceName.plural)}
            body={props.empty?.body ?? tableCopy.emptyBody}
            action={props.empty?.action}
          />
        ) : null}
      </div>
      <ResourceTablePagination
        page={props.page}
        perPage={props.perPage}
        total={props.total}
        onPageChange={props.onPageChange}
        onPerPageChange={props.onPerPageChange}
      />
      <FloatingBar open={selectedIds.length > 0 && Boolean(props.bulkActions)}>
        <span className="text-caption font-medium whitespace-nowrap text-foreground">
          {tableCopy.selected(
            selectedIds.length,
            props.resourceName.singular,
            props.resourceName.plural,
          )}
        </span>
        {props.bulkActions?.(selectedIds, clearSelection)}
        <Button variant="ghost" size="sm" className="rounded-full" onClick={clearSelection}>
          {tableCopy.clearSelection}
        </Button>
      </FloatingBar>
    </Card>
  )
}
