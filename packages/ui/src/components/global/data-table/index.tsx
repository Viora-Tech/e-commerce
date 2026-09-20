'use client'

import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'
import { Checkbox } from '../../shadcn/checkbox'
import { Skeleton } from '../../shadcn/skeleton'
import EmptyState from '../empty-state'
import GlobalTooltip from '../global-tooltip'
import IconComponent from '../icon-component'

// ─── Types ───────────────────────────────────────────────────────────────────

type ColumnAlign = 'left' | 'center' | 'right'

export type DataTableColumn<T> = {
  key: string
  label: string
  render: (item: T, index: number) => ReactNode
  align?: ColumnAlign
  sortable?: boolean
  /** Flex grow value (default: 1). Use 2 for wider columns, 0 for fixed-width. */
  flex?: number
  /** Fixed width class (e.g. "w-[72px]"). When set, column won't flex-grow. */
  width?: string
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  data: T[]
  /** Unique key extractor for each row */
  getRowId: (item: T) => string

  // ─── Selection ──────────────────────────────────────────────────────
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void

  // ─── Row interaction ────────────────────────────────────────────────
  onRowClick?: (item: T) => void
  /** When false, row click is suppressed and row is styled as non-interactive. Defaults to true. */
  isRowClickable?: (item: T) => boolean
  /** Tooltip shown when hovering a non-clickable row. */
  getRowTooltip?: (item: T) => string | undefined

  sortKey?: string
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (key: string, order: 'asc' | 'desc') => void

  // ─── States ─────────────────────────────────────────────────────────
  loading?: boolean
  loadingRows?: number
  error?: string | null
  onRetry?: () => void
  errorRequestId?: string
  emptyMessage?: string
  emptyDescription?: string

  // ─── Styling ────────────────────────────────────────────────────────
  /** Alternating row backgrounds (default: true) */
  striped?: boolean
  className?: string
  /** Row height class (default: "h-12") */
  rowHeight?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const alignClass = (align?: ColumnAlign) => {
  if (align === 'center') return 'justify-center text-center'
  if (align === 'right') return 'justify-end text-right'
  return ''
}

const colStyle = (col: { flex?: number; width?: string }) =>
  col.width ? undefined : { flex: col.flex ?? 1 }

const colClass = (col: { flex?: number; width?: string; align?: ColumnAlign }) =>
  cn('flex items-center', col.width ?? 'min-w-0', alignClass(col.align))

// ─── Loading skeleton ────────────────────────────────────────────────────────

const TITLE_WIDTHS = [
  'w-[75%]',
  'w-[50%]',
  'w-[65%]',
  'w-[40%]',
  'w-[80%]',
  'w-[55%]',
  'w-[70%]',
  'w-[45%]',
]
const CELL_WIDTHS = ['w-16', 'w-14', 'w-20', 'w-12', 'w-18', 'w-16', 'w-14', 'w-20']

function DataTableSkeleton<T>({
  columns,
  rows,
  selectable,
  rowHeight,
}: {
  columns: DataTableColumn<T>[]
  rows: number
  selectable?: boolean
  rowHeight: string
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl">
      <div className="flex w-full items-center gap-5 rounded-t-xl border border-border bg-secondary/20 p-3">
        {selectable && <Skeleton className="size-4 shrink-0 rounded-sm" />}
        {columns.map((col) => (
          <div className={colClass(col)} key={col.key} style={colStyle(col)}>
            <Skeleton className="h-3 w-16 rounded-sm" />
          </div>
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          className={cn(
            'flex w-full items-center gap-5 px-3',
            rowHeight,
            rowIdx % 2 === 0 ? 'bg-secondary/80' : 'bg-secondary/20',
          )}
          key={rowIdx}
          style={{ animationDelay: `${rowIdx * 75}ms` }}
        >
          {selectable && <Skeleton className="size-4 shrink-0 rounded-sm" />}
          {columns.map((col, colIdx) => (
            <div className={colClass(col)} key={col.key} style={colStyle(col)}>
              <Skeleton
                className={cn(
                  'h-3.5 rounded-sm',
                  colIdx === 0
                    ? TITLE_WIDTHS[rowIdx % TITLE_WIDTHS.length]
                    : CELL_WIDTHS[(rowIdx + colIdx) % CELL_WIDTHS.length],
                )}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  getRowId,
  selectable,
  selectedIds,
  onSelectionChange,
  onRowClick,
  isRowClickable,
  getRowTooltip,
  sortKey,
  sortOrder = 'asc',
  onSortChange,
  loading,
  loadingRows = 8,
  error,
  onRetry,
  errorRequestId,
  emptyMessage = 'No data found.',
  emptyDescription,
  striped = true,
  className,
  rowHeight = 'h-12',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <DataTableSkeleton
        columns={columns}
        rowHeight={rowHeight}
        rows={loadingRows}
        selectable={selectable}
      />
    )
  }

  if (error) {
    return (
      <EmptyState
        action={
          onRetry
            ? {
                icon: 'RefreshCw',
                label: 'Retry',
                onClick: onRetry,
              }
            : undefined
        }
        cardClassName="min-h-48"
        description={errorRequestId ? `${error} Request ID: ${errorRequestId}` : error}
        icon="TriangleAlert"
        state="ERROR"
        title="We couldn't load this. Try again."
      />
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 w-full flex-col items-center justify-center gap-1 rounded-xl bg-secondary/20">
        <span className="text-sm font-medium text-foreground">{emptyMessage}</span>
        {emptyDescription && (
          <span className="text-xs text-muted-foreground">{emptyDescription}</span>
        )}
      </div>
    )
  }

  const allSelected =
    selectable && data.length > 0 && data.every((item) => selectedIds?.has(getRowId(item)))

  const handleToggleAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(data.map((item) => getRowId(item))))
    }
  }

  const handleToggleRow = (id: string) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectionChange(next)
  }

  const handleSortHeaderClick = (col: DataTableColumn<T>) => {
    if (!col.sortable || !onSortChange) return
    const nextOrder = sortKey === col.key && sortOrder === 'asc' ? 'desc' : 'asc'
    onSortChange(col.key, nextOrder)
  }

  return (
    <div className={cn('w-full overflow-hidden rounded-xl', className)}>
      {/* Header */}
      <div className="flex w-full items-center gap-5 rounded-t-xl border border-border bg-secondary/20 p-3">
        {selectable && (
          <Checkbox checked={allSelected} className="shrink-0" onCheckedChange={handleToggleAll} />
        )}
        {columns.map((col) => (
          <div
            className={cn(
              colClass(col),
              'text-xs font-medium text-muted-foreground',
              col.sortable && onSortChange && 'cursor-pointer select-none hover:text-foreground',
            )}
            key={col.key}
            onClick={() => handleSortHeaderClick(col)}
            style={colStyle(col)}
          >
            <span className="truncate">{col.label}</span>
            {col.sortable && onSortChange && sortKey === col.key ? (
              <IconComponent
                className="ml-1 size-3.5 shrink-0 opacity-100"
                icon={sortOrder === 'desc' ? 'ChevronDown' : 'ChevronUp'}
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.map((item, index) => {
        const id = getRowId(item)
        const isSelected = selectedIds?.has(id)
        const clickable = Boolean(onRowClick && (isRowClickable?.(item) ?? true))
        const rowTooltip = !clickable ? getRowTooltip?.(item) : undefined

        const row = (
          <div
            aria-disabled={onRowClick ? !clickable : undefined}
            className={cn(
              'flex w-full items-center gap-5 overflow-hidden px-3 py-3',
              rowHeight,
              striped && (index % 2 === 0 ? 'bg-secondary/80' : 'bg-secondary/20'),
              clickable && 'cursor-pointer hover:bg-secondary/60',
              onRowClick && !clickable && 'pointer-events-none opacity-50',
              isSelected && 'bg-primary/5',
            )}
            key={id}
            onClick={() => {
              if (!clickable) return
              onRowClick?.(item)
            }}
          >
            {selectable && (
              <Checkbox
                checked={isSelected}
                className="shrink-0"
                onCheckedChange={() => handleToggleRow(id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {columns.map((col) => (
              <div
                className={cn(colClass(col), 'overflow-hidden')}
                key={col.key}
                style={colStyle(col)}
              >
                {col.render(item, index)}
              </div>
            ))}
          </div>
        )

        if (rowTooltip) {
          return (
            <GlobalTooltip
              content={rowTooltip}
              direction="top"
              key={id}
              trigger={<div className="pointer-events-auto w-full cursor-not-allowed">{row}</div>}
            />
          )
        }

        return row
      })}
    </div>
  )
}
