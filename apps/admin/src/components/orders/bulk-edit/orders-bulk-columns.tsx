import { cn } from '@commerce/ui/lib/utils'
import { type Column, renderTextEditor } from 'react-data-grid'
import { INDIAN_STATES, stateName } from '@/data/india'
import type { ordersBulkEditContent } from '@/data/orders-bulk-edit'
import type { Formatters } from '@/lib/format'
import {
  type CellErrors,
  canEdit,
  EDITABLE_KEYS,
  errorKey,
  type GridRow,
  isDirty,
  type Mark,
} from './orders-bulk-model'
import OrdersBulkSelectEditor from './orders-bulk-select-editor'

type Copy = typeof ordersBulkEditContent

const WIDTHS: Record<string, number> = {
  number: 110,
  placed: 120,
  name: 180,
  email: 220,
  phone: 140,
  line1: 220,
  line2: 180,
  city: 140,
  stateCode: 180,
  pincode: 110,
  tags: 200,
  mark: 140,
}

const SELECTS = new Set(['stateCode', 'mark'])

/**
 * The grid's columns in sheet order: order number (frozen), placed, then the editable cells.
 * Changed cells get the soft accent wash, invalid ones the danger wash with the message as a
 * tooltip; locked cells of imported orders are grey. A failed save marks the row's first cell.
 */
export function buildColumns(
  copy: Copy,
  fmt: Formatters,
  base: Map<string, GridRow>,
  errors: CellErrors,
): Column<GridRow>[] {
  const names = copy.columns as Record<string, string>
  return ['number', 'placed', ...EDITABLE_KEYS].map((key) => {
    const message = (row: GridRow) =>
      errors.get(errorKey(row.id, key)) ??
      (key === 'number' ? errors.get(errorKey(row.id, 'row')) : undefined)
    return {
      key,
      name: names[key] ?? key,
      width: WIDTHS[key] ?? 140,
      frozen: key === 'number',
      editable: (row: GridRow) => canEdit(row, key),
      renderEditCell: SELECTS.has(key) ? OrdersBulkSelectEditor : renderTextEditor,
      renderCell: ({ row }) => {
        let text = String((row as Record<string, unknown>)[key] ?? '')
        if (key === 'number') text = `#${row.number}`
        else if (key === 'placed') text = fmt.date(row.placed)
        else if (key === 'stateCode') text = stateName(row.stateCode)
        else if (key === 'mark') text = row.mark ? copy.marks[row.mark as Mark] : copy.none
        return <span title={message(row)}>{text}</span>
      },
      cellClass: (row) =>
        cn(
          'text-body',
          canEdit(row, key) ? '' : 'bg-muted text-muted-foreground',
          isDirty(row, base.get(row.id), key) ? 'bg-primary-soft' : '',
          message(row) ? 'bg-danger-soft text-danger' : '',
        ),
    }
  })
}
