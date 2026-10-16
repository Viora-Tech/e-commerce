import type { RenderEditCellProps } from 'react-data-grid'
import { INDIAN_STATES } from '@/data/india'
import { ordersBulkEditContent } from '@/data/orders-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { type GridRow, MARKS } from './orders-bulk-model'

/** State and Mark as cell editor: a native select that commits as soon as one is picked. */
export default function OrdersBulkSelectEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<GridRow>) {
  // Hooks
  const copy = useCopy(ordersBulkEditContent)

  // Render logic
  const isState = column.key === 'stateCode'
  const value = isState ? row.stateCode : row.mark
  return (
    <select
      // biome-ignore lint/a11y/noAutofocus: the editor opens because the person asked to edit this cell.
      autoFocus
      value={value}
      aria-label={String(column.name)}
      onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value }, true)}
      onKeyDown={(e) => e.key === 'Escape' && onClose(false)}
      className="size-full border-0 bg-card px-2 text-body text-foreground outline-none"
    >
      <option value="">{copy.none}</option>
      {isState
        ? INDIAN_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))
        : MARKS.map((m) => (
            <option key={m} value={m}>
              {copy.marks[m]}
            </option>
          ))}
    </select>
  )
}
