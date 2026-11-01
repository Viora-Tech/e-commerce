import type { RenderEditCellProps } from 'react-data-grid'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { cellValue, type GridRow, STATUSES, withCell } from './bulk-edit-model'

/** Select cell editor (status, Yes/No): a native select that commits as soon as one is picked. */
export default function BulkSelectEditor<R extends GridRow>({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<R>) {
  // Hooks
  const copy = useCopy(bulkEditContent)

  // Render logic
  const isStatus = column.key === 'status'
  const options = isStatus
    ? STATUSES.map((s) => ({ value: s, label: copy.statuses[s] }))
    : (['yes', 'no'] as const).map((v) => ({ value: v, label: copy.yesNo[v] }))
  const label = (copy.columns as Record<string, unknown>)[column.key]

  return (
    <select
      // biome-ignore lint/a11y/noAutofocus: the editor opens because the person asked to edit this cell.
      autoFocus
      value={cellValue(row, column.key)}
      aria-label={typeof label === 'string' ? label : column.key}
      onChange={(e) => onRowChange(withCell(row, column.key, e.target.value), true)}
      onKeyDown={(e) => e.key === 'Escape' && onClose(false)}
      className="size-full border-0 bg-card px-2 text-body text-foreground outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
