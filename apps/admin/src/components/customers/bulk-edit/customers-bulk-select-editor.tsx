import type { RenderEditCellProps } from 'react-data-grid'
import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import type { GridRow } from './customers-bulk-model'

/** Marketing consent cell editor: a native select that commits as soon as one is picked. */
export default function CustomersBulkSelectEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<GridRow>) {
  // Hooks
  const copy = useCopy(customersBulkEditContent)

  // Render logic
  return (
    <select
      // biome-ignore lint/a11y/noAutofocus: the editor opens because the person asked to edit this cell.
      autoFocus
      value={String((row as Record<string, unknown>)[column.key] ?? 'no')}
      aria-label={String(column.name)}
      onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value }, true)}
      onKeyDown={(e) => e.key === 'Escape' && onClose(false)}
      className="size-full border-0 bg-card px-2 text-body text-foreground outline-none"
    >
      <option value="yes">{copy.consent.yes}</option>
      <option value="no">{copy.consent.no}</option>
    </select>
  )
}
