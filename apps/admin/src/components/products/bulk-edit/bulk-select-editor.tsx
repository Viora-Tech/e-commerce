import type { RenderEditCellProps } from 'react-data-grid'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { type GridRow, STATUSES } from './bulk-edit-model'

/** Status cell editor: a native select that commits as soon as one is picked. */
export default function BulkSelectEditor({
  row,
  onRowChange,
  onClose,
}: RenderEditCellProps<GridRow>) {
  // Hooks
  const copy = useCopy(bulkEditContent)

  return (
    <select
      // biome-ignore lint/a11y/noAutofocus: the editor opens because the person asked to edit this cell.
      autoFocus
      value={row.status}
      aria-label={copy.columns.status}
      onChange={(e) => onRowChange({ ...row, status: e.target.value }, true)}
      onKeyDown={(e) => e.key === 'Escape' && onClose(false)}
      className="size-full border-0 bg-card px-2 text-body text-foreground outline-none"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {copy.statuses[s]}
        </option>
      ))}
    </select>
  )
}
