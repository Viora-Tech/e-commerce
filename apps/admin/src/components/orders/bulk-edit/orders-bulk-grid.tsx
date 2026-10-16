'use client'

import { type ClipboardEvent, useRef } from 'react'
import { type CellKeyboardEvent, type CellKeyDownArgs, DataGrid } from 'react-data-grid'
import 'react-data-grid/lib/styles.css'
import { ordersBulkEditContent } from '@/data/orders-bulk-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { buildColumns } from './orders-bulk-columns'
import {
  applyPaste,
  type CellErrors,
  COLUMN_KEYS,
  canEdit,
  cellValue,
  type GridRow,
  withCell,
} from './orders-bulk-model'

type OrdersBulkGridProps = {
  rows: GridRow[]
  /** The sheet as loaded, to light up changed cells. */
  base: Map<string, GridRow>
  errors: CellErrors
  onRowsChange: (rows: GridRow[]) => void
}

const ROW_HEIGHT = 40
/** The same row height in rem, to size the grid to its rows. */
const ROW_REM = ROW_HEIGHT / 16

const rowKey = (row: GridRow) => row.id

/** The spreadsheet: type, paste a block, drag the corner or press Ctrl+D to fill down. */
export default function OrdersBulkGrid({ rows, base, errors, onRowsChange }: OrdersBulkGridProps) {
  // Hooks
  const copy = useCopy(ordersBulkEditContent)
  const fmt = useFormat()
  const active = useRef<{ rowIdx: number; key: string } | null>(null)

  // Event handlers
  const handleFill = ({
    columnKey,
    sourceRow,
    targetRow,
  }: {
    columnKey: string
    sourceRow: GridRow
    targetRow: GridRow
  }) =>
    canEdit(targetRow, columnKey)
      ? withCell(targetRow, columnKey, cellValue(sourceRow, columnKey))
      : targetRow

  const handleCopy = (
    { row, column }: { row: GridRow; column: { key: string } },
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
  const handleKeyDown = (args: CellKeyDownArgs<GridRow>, event: CellKeyboardEvent) => {
    if (args.mode !== 'ACTIVE' || !args.row || !args.column) return
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'd') return
    const above = rows[args.rowIdx - 1]
    const key = args.column.key
    if (!above || !canEdit(args.row, key)) return
    event.preventDefault()
    onRowsChange(
      rows.map((r, i) => (i === args.rowIdx ? withCell(r, key, cellValue(above, key)) : r)),
    )
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const at = active.current
    if (!at || target.tagName === 'INPUT' || target.tagName === 'SELECT') return
    event.preventDefault()
    event.stopPropagation()
    const colIdx = COLUMN_KEYS.indexOf(at.key)
    if (colIdx < 0) return
    const pasted = event.clipboardData.getData('text/plain')
    onRowsChange(applyPaste(rows, { rowIdx: at.rowIdx, colIdx }, pasted))
  }

  // Render logic
  const columns = buildColumns(copy, fmt, base, errors)

  return (
    <div
      onPasteCapture={handlePaste}
      className="overflow-hidden rounded-2xl border border-border surface-card"
    >
      <DataGrid
        aria-label={copy.title}
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKey}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={ROW_HEIGHT}
        defaultColumnOptions={{ resizable: true }}
        onRowsChange={onRowsChange}
        onFill={handleFill}
        onCellCopy={handleCopy}
        onActivePositionChange={handleActive}
        onCellKeyDown={handleKeyDown}
        style={{ height: `min(${(rows.length + 1) * ROW_REM}rem, calc(100dvh - 18rem))` }}
        className="border-0 [--rdg-background-color:var(--card)] [--rdg-border-color:var(--hairline)] [--rdg-color:var(--foreground)] [--rdg-header-background-color:var(--muted)] [--rdg-row-hover-background-color:var(--muted)] [--rdg-selection-color:var(--primary)]"
      />
    </div>
  )
}
