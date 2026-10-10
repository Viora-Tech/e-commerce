'use client'

import { type ClipboardEvent, useRef } from 'react'
import { type CellKeyboardEvent, type CellKeyDownArgs, DataGrid } from 'react-data-grid'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import '@/styles/vendor-grid.css'
import { buildColumns, columnKeys, isEditableKey, type SheetLocation } from './bulk-edit-columns'
import {
  applyPaste,
  type CellErrors,
  cellValue,
  type GridRow,
  syncProductCell,
  withCell,
} from './bulk-edit-model'

type BulkEditGridProps = {
  rows: GridRow[]
  /** The sheet as loaded, to light up changed cells. */
  base: Map<string, GridRow>
  errors: CellErrors
  locations: SheetLocation[]
  onRowsChange: (rows: GridRow[]) => void
}

const ROW_HEIGHT = 40

const rowKey = (row: GridRow) => row.variantId

/** The spreadsheet: type, paste a block, drag the corner or press Ctrl+D to fill down. */
export default function BulkEditGrid({
  rows,
  base,
  errors,
  locations,
  onRowsChange,
}: BulkEditGridProps) {
  // Hooks
  const copy = useCopy(bulkEditContent)
  const active = useRef<{ rowIdx: number; key: string } | null>(null)

  // Event handlers
  const handleChange = (next: GridRow[], data: { indexes: number[]; column: { key: string } }) => {
    let synced = next
    for (const i of data.indexes) {
      const row = next[i]
      if (row) synced = syncProductCell(synced, row, data.column.key)
    }
    onRowsChange(synced)
  }

  const handleFill = ({
    columnKey,
    sourceRow,
    targetRow,
  }: {
    columnKey: string
    sourceRow: GridRow
    targetRow: GridRow
  }) =>
    isEditableKey(columnKey)
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
    if (!above || !isEditableKey(key)) return
    event.preventDefault()
    const next = rows.map((r, i) =>
      i === args.rowIdx ? withCell(r, key, cellValue(above, key)) : r,
    )
    onRowsChange(syncProductCell(next, next[args.rowIdx] as GridRow, key))
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
      applyPaste(
        rows,
        keys,
        { rowIdx: at.rowIdx, colIdx },
        event.clipboardData.getData('text/plain'),
        isEditableKey,
      ),
    )
  }

  // Render logic
  const keys = columnKeys(locations)
  const columns = buildColumns(copy, locations, base, errors)

  return (
    <div
      onPasteCapture={handlePaste}
      className="overflow-hidden rounded-2xl border border-border surface-card [--rdg-background-color:var(--card)] [--rdg-border-color:var(--border)] [--rdg-color:var(--foreground)] [--rdg-header-background-color:var(--muted)] [--rdg-row-hover-background-color:var(--muted)] [--rdg-selection-color:var(--primary)]"
    >
      <DataGrid
        aria-label={copy.title}
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKey}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={ROW_HEIGHT}
        defaultColumnOptions={{ resizable: true }}
        onRowsChange={handleChange}
        onFill={handleFill}
        onCellCopy={handleCopy}
        onActivePositionChange={handleActive}
        onCellKeyDown={handleKeyDown}
        className="h-[min(40rem,calc(100dvh-18rem))] border-0"
      />
    </div>
  )
}
