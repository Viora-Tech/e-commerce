'use client'

import { type ClipboardEvent, useRef } from 'react'
import {
  type CellKeyboardEvent,
  type CellKeyDownArgs,
  DataGrid,
  SelectColumn,
} from 'react-data-grid'
import 'react-data-grid/lib/styles.css'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { buildColumns, columnKeys, type SheetLocation } from './bulk-edit-columns'
import { type CellErrors, cellValue, type GridRow, withCell } from './bulk-edit-model'
import {
  applyViewChanges,
  buildView,
  isViewEditable,
  pasteIntoView,
  setViewCell,
  type ViewRow,
} from './bulk-edit-view'

type BulkEditGridProps = {
  rows: GridRow[]
  /** The sheet as loaded, to light up changed cells. */
  base: Map<string, GridRow>
  errors: CellErrors
  locations: SheetLocation[]
  /** Column keys switched off in the Columns menu. */
  hidden: Set<string>
  /** Ticked rows (`ViewRow.viewKey`): product rows and variant rows. */
  selected: ReadonlySet<string>
  /** Products whose variant rows are shown under them. */
  expanded: ReadonlySet<string>
  onExpandedChange: (expanded: Set<string>) => void
  onRowsChange: (rows: GridRow[]) => void
  onSelectedChange: (selected: Set<string>) => void
}

const ROW_HEIGHT = 40
/** The same row height in rem, to size the grid to its rows. */
const ROW_REM = ROW_HEIGHT / 16

const rowKey = (row: ViewRow) => row.viewKey

/**
 * The spreadsheet: one row per product, expanding to its variants (#985). Type, paste a block,
 * drag the corner or press Ctrl+D to fill down.
 */
export default function BulkEditGrid({
  rows,
  base,
  errors,
  locations,
  hidden,
  selected,
  expanded,
  onExpandedChange,
  onRowsChange,
  onSelectedChange,
}: BulkEditGridProps) {
  // Hooks
  const copy = useCopy(bulkEditContent)
  const active = useRef<{ rowIdx: number; key: string } | null>(null)

  // Event handlers
  const handleChange = (next: ViewRow[], data: { indexes: number[]; column: { key: string } }) =>
    onRowsChange(applyViewChanges(rows, view, next, data.indexes, data.column.key))

  const handleToggle = (productId: string) => {
    const next = new Set(expanded)
    if (next.has(productId)) next.delete(productId)
    else next.add(productId)
    onExpandedChange(next)
  }

  const handleFill = ({
    columnKey,
    sourceRow,
    targetRow,
  }: {
    columnKey: string
    sourceRow: ViewRow
    targetRow: ViewRow
  }) =>
    isViewEditable(targetRow, columnKey) && !sourceRow.mixedKeys.includes(columnKey)
      ? withCell(targetRow, columnKey, cellValue(sourceRow, columnKey))
      : targetRow

  const handleCopy = (
    { row, column }: { row: ViewRow; column: { key: string } },
    event: ClipboardEvent<HTMLDivElement>,
  ) => {
    event.clipboardData.setData('text/plain', cellValue(row, column.key))
    event.preventDefault()
  }

  const handleActive = ({
    rowIdx,
    column,
  }: {
    rowIdx: number
    column?: { key: string } | undefined
  }) => {
    active.current = column ? { rowIdx, key: column.key } : null
  }

  /** Ctrl+D (Cmd+D): copy the cell above into the active cell, like a spreadsheet's fill down. */
  const handleKeyDown = (args: CellKeyDownArgs<ViewRow>, event: CellKeyboardEvent) => {
    if (args.mode !== 'ACTIVE' || !args.row || !args.column) return
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'd') return
    const above = view[args.rowIdx - 1]
    const key = args.column.key
    if (!above || above.mixedKeys.includes(key) || !isViewEditable(args.row, key)) return
    event.preventDefault()
    onRowsChange(setViewCell(rows, args.row, key, cellValue(above, key)))
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const at = active.current
    if (!at || target.tagName === 'INPUT' || target.tagName === 'SELECT') return
    event.preventDefault()
    event.stopPropagation()
    const colIdx = keys.indexOf(at.key)
    if (colIdx < 0) return
    onRowsChange(
      pasteIntoView(
        rows,
        view,
        keys,
        { rowIdx: at.rowIdx, colIdx },
        event.clipboardData.getData('text/plain'),
      ),
    )
  }

  // Render logic
  const view = buildView(rows, expanded)
  const keys = columnKeys(locations, hidden)
  const columns = [
    SelectColumn,
    ...buildColumns(copy, locations, base, errors, hidden, { expanded, onToggle: handleToggle }),
  ]

  return (
    <div
      onPasteCapture={handlePaste}
      className="overflow-hidden rounded-2xl border border-border surface-card"
    >
      <DataGrid
        aria-label={copy.title}
        columns={columns}
        rows={view}
        rowKeyGetter={rowKey}
        selectedRows={selected}
        onSelectedRowsChange={onSelectedChange}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={ROW_HEIGHT}
        defaultColumnOptions={{ resizable: true }}
        onRowsChange={handleChange}
        onFill={handleFill}
        onCellCopy={handleCopy}
        onActivePositionChange={handleActive}
        onCellKeyDown={handleKeyDown}
        style={{ height: `min(${(view.length + 1) * ROW_REM}rem, calc(100dvh - 18rem))` }}
        className="border-0 [--rdg-background-color:var(--card)] [--rdg-border-color:var(--hairline)] [--rdg-color:var(--foreground)] [--rdg-header-background-color:var(--muted)] [--rdg-row-hover-background-color:var(--muted)] [--rdg-selection-color:var(--primary)]"
      />
    </div>
  )
}
