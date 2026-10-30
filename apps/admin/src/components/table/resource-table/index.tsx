'use client'

import { SearchX } from '@commerce/ui/icons'
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
  type ColumnOrderState,
  type ColumnVisibilityState,
  createColumnHelper,
  type ExpandedState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Updater,
  useTable,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { type CSSProperties, type ReactNode, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { type FilterGroup, hasFilter } from '@/components/table/filter-panel'
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
import SelectionBar from './selection-bar'
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
  /**
   * The one way to switch a list's views (Figma Table / View select): pass a `ViewSelect`.
   * There are no pill tabs on tables, so every list looks the same.
   */
  views?: ReactNode
  /**
   * The list's filters (`lib/*-list-filters.ts` groups). The toolbar's Filter menu lists them;
   * each applied one shows as a chip with its own popover. URL params stay the source of truth.
   */
  filterGroups?: FilterGroup[] | undefined | undefined
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
  /**
   * The bulk actions. While rows are ticked the header row turns into the bulk bar (Shopify):
   * the selection menu, these actions (the main ones as buttons, the rest in a More menu), and
   * "Show all selected". Call `clear` after one runs.
   */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode
  /**
   * Every id the current search and filters match, for the selection bar's "Select all N"
   * (Shopify-style). Without it, selection stays on the visible page.
   */
  loadAllIds?: (() => Promise<string[]>) | undefined
  empty?: { heading: string; body?: string; action?: ReactNode }
  /** Replaces the generic "No results" when a search or filter finds nothing. */
  noResults?: { heading: string; body?: string; action?: ReactNode } | undefined
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
  /** The order the server sends, shown ticked in the sort menu (Orders: Date, newest first). */
  defaultSort?: { id: string; desc: boolean } | undefined
  /** Columns that start hidden; the columns menu can show them. */
  defaultHidden?: string[] | undefined
  /**
   * A tree table (Inventory's Products view): rows with sub rows fold them underneath. A click
   * on such a row toggles it; sorting keeps sub rows under their row; ticking it ticks its sub
   * rows, and only rows without sub rows are ever in the selection.
   */
  tree?:
    | {
        getSubRows: (item: T) => T[] | undefined
        expanded: Record<string, boolean>
        onExpandedChange: (expanded: Record<string, boolean>) => void
      }
    | undefined
}

const SKELETON_ROWS = 6

/** The page's default-hidden columns as TanStack visibility (`false` = hidden). */
function hiddenColumns(ids: string[] | undefined): ColumnVisibilityState {
  return Object.fromEntries((ids ?? []).map((id) => [id, false]))
}

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

/** The table's expanded rows: the page's own (`tree`), as TanStack state. */
function useExpanded<T extends RowData>(tree: ResourceTableProps<T>['tree']) {
  const value: ExpandedState = tree?.expanded ?? {}
  const set = (next: Updater<ExpandedState>, expandable: () => string[]) => {
    const resolved = typeof next === 'function' ? next(value) : next
    tree?.onExpandedChange(
      resolved === true ? Object.fromEntries(expandable().map((id) => [id, true])) : resolved,
    )
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
  const [sorting, setSorting] = useState<SortingState>(props.defaultSort ? [props.defaultSort] : [])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    hiddenColumns(props.defaultHidden),
  )
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [rowSelection, setRowSelection] = useRowSelection(props.selection)
  const [onlySelected, setOnlySelected] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const [expanded, setExpanded] = useExpanded(props.tree)
  const table = useTable({
    features: resourceTableFeatures,
    data: props.items,
    columns: tableColumns(props),
    getRowId: (row) => props.getId(row),
    getSubRows: props.tree?.getSubRows,
    // In a tree only the leaves are selected; a parent's box ticks them (see `selectionColumn`).
    enableRowSelection:
      props.tree && (props.selectable ?? true)
        ? (row) => row.subRows.length === 0
        : (props.selectable ?? true),
    // The page owns the expanded rows; a refresh after an edit keeps them open.
    autoResetExpanded: false,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    onExpandedChange: (next) =>
      setExpanded(next, () =>
        table
          .getCoreRowModel()
          .flatRows.filter((r) => r.subRows.length > 0)
          .map((r) => r.id),
      ),
    state: { sorting, columnVisibility, columnOrder, rowSelection, expanded },
  })

  // Helpers
  const clearSelection = () => {
    setRowSelection({})
    setOnlySelected(false)
  }
  const selectAllMatching = async () => {
    if (!props.loadAllIds) return
    setSelectingAll(true)
    try {
      const ids = await props.loadAllIds()
      setRowSelection(Object.fromEntries(ids.map((id) => [id, true])))
    } finally {
      setSelectingAll(false)
    }
  }
  const handleClearNarrowing = () => {
    props.onClearAll?.()
    if (props.query) props.onQueryChange('')
  }
  const resetColumns = () => {
    setColumnVisibility(hiddenColumns(props.defaultHidden))
    setColumnOrder([])
  }

  // Render logic
  const columnTitles = Object.fromEntries(props.columns.map((c) => [c.id, c.title]))
  const sortTitles = Object.fromEntries(props.columns.map((c) => [c.id, c.sortTitle ?? c.title]))
  const sortOrder = props.columns
    .map((c, i) => ({ id: c.id, rank: c.sortRank ?? props.columns.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map((c) => c.id)
  const sortLabels = Object.fromEntries(
    props.columns.flatMap((c) => (c.sortLabels ? [[c.id, c.sortLabels]] : [])),
  )
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  /* While rows are ticked the header row turns into the bulk bar. */
  const selecting = selectedIds.length > 0 && Boolean(props.bulkActions)
  /* "Show all selected": only the ticked rows (a tree row stays while any sub row is ticked). */
  const showSelected = onlySelected && selecting
  // Nothing ticked any more (the last row unticked): the next selection starts on every row.
  if (onlySelected && !selecting) setOnlySelected(false)
  const rows = showSelected
    ? table.getRowModel().rows.filter((r) => r.getIsSelected() || r.getIsSomeSelected())
    : table.getRowModel().rows
  const visibleCount = table.getVisibleLeafColumns().length
  /* The grid never squeezes a column below ~8rem: on a phone it scrolls sideways instead of
     letting dates, totals and pills run into each other (#895). */
  const minWidth = { '--table-min-width': `${Math.max(40, visibleCount * 8)}rem` } as CSSProperties
  const isEmpty = !props.loading && props.items.length === 0
  /** A search or a filter is narrowing the list (so empty means "no results", not "none yet"). */
  const narrowed = props.query.length > 0 || (props.filterGroups ?? []).some(hasFilter)

  return (
    <Card gap="none" inset="y-none" className="overflow-hidden">
      <ResourceTableToolbar
        table={table}
        plural={props.resourceName.plural}
        query={props.query}
        onQueryChange={props.onQueryChange}
        views={props.views}
        filterGroups={props.filterGroups}
        columnTitles={columnTitles}
        sortTitles={sortTitles}
        sortOrder={sortOrder}
        sortLabels={sortLabels}
        columnOrder={columnOrder}
        onResetColumns={resetColumns}
      />
      <div className="relative">
        {/* While rows are ticked the bulk bar takes the header row. It sits outside the sideways
            scroller so its actions stay in view; the header cells stay underneath (inert) so the
            columns keep their widths. */}
        {selecting ? (
          <div className="absolute inset-x-0 top-0 z-10">
            <SelectionBar
              count={selectedIds.length}
              total={props.total}
              pageFull={table.getIsAllPageRowsSelected()}
              onTogglePage={(checked) =>
                checked ? table.toggleAllPageRowsSelected(true) : clearSelection()
              }
              plural={props.resourceName.plural}
              singular={props.resourceName.singular}
              onSelectAll={props.loadAllIds ? selectAllMatching : undefined}
              selectingAll={selectingAll}
              showSelected={showSelected}
              onShowSelectedChange={setOnlySelected}
              actions={props.bulkActions?.(selectedIds, clearSelection)}
              onClear={clearSelection}
            />
          </div>
        ) : null}
        <div className="no-scrollbar overflow-x-auto">
          <Table
            className="w-full min-w-(--table-min-width) table-fixed border-separate border-spacing-0"
            style={minWidth}
          >
            <TableHeader className="[&_tr]:border-0" inert={selecting}>
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
                        <TableCell
                          key={`skeleton-${i.toString()}-${j.toString()}`}
                          className={CELL}
                        >
                          <Skeleton className={cn('h-3.5', j === 0 ? 'w-4' : 'w-full max-w-32')} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => {
                    const target = props.href?.(row.original)
                    const folds = Boolean(props.tree) && row.getCanExpand()
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() ? 'selected' : undefined}
                        className={cn(
                          'group/row border-0 tabular-nums transition-colors duration-150 hover:bg-row-hover data-[state=selected]:bg-primary-soft motion-reduce:transition-none',
                          (target || folds) && 'cursor-pointer',
                        )}
                        onClick={
                          target
                            ? () => router.push(target)
                            : folds
                              ? () => row.toggleExpanded()
                              : undefined
                        }
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
          {isEmpty && narrowed ? (
            // Figma "Feedback state · No results": the search or filters found nothing.
            <EmptyState
              icon={SearchX}
              heading={props.noResults?.heading ?? tableCopy.noResults}
              body={props.noResults?.body ?? tableCopy.noResultsBody}
              action={
                props.noResults?.action ?? (
                  <Button variant="outline" size="sm" onClick={handleClearNarrowing}>
                    {tableCopy.clearSearchAndFilters}
                  </Button>
                )
              }
            />
          ) : isEmpty ? (
            <EmptyState
              heading={props.empty?.heading ?? tableCopy.emptyHeading(props.resourceName.plural)}
              body={props.empty?.body ?? tableCopy.emptyBody}
              action={props.empty?.action}
            />
          ) : null}
        </div>
      </div>
      <ResourceTablePagination
        page={props.page}
        perPage={props.perPage}
        total={props.total}
        onPageChange={props.onPageChange}
        onPerPageChange={props.onPerPageChange}
      />
    </Card>
  )
}
