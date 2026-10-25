import { cn } from '@commerce/ui/lib/utils'
import { type Column, renderTextEditor } from 'react-data-grid'
import type { customersBulkEditContent } from '@/data/customers-bulk-edit'
import {
  type CellErrors,
  canEdit,
  errorKey,
  type GridRow,
  isConsentKey,
  isDirty,
} from './customers-bulk-model'
import CustomersBulkSelectEditor from './customers-bulk-select-editor'

type Copy = typeof customersBulkEditContent

const WIDTHS: Record<string, number> = {
  email: 240,
  name: 180,
  phone: 150,
  tags: 200,
  note: 240,
  acceptsMarketing: 160,
  acceptsWhatsapp: 170,
  acceptsSms: 150,
  gstin: 180,
  businessName: 200,
  city: 150,
  stateCode: 110,
  pincode: 110,
}

/**
 * The grid's columns in sheet order: email (frozen, read-only), then the editable cells.
 * Changed cells get the soft accent wash, invalid ones the danger wash with the message as a
 * tooltip; erased customers, and the address cells of a customer with no default address,
 * are grey. A failed save marks the row's first cell.
 */
export function buildColumns(
  copy: Copy,
  base: Map<string, GridRow>,
  errors: CellErrors,
  keys: readonly string[],
): Column<GridRow>[] {
  const names = copy.columns as Record<string, string>
  return keys.map((key) => {
    const message = (row: GridRow) =>
      errors.get(errorKey(row.id, key)) ??
      (key === 'email' ? errors.get(errorKey(row.id, 'row')) : undefined)
    return {
      key,
      name: names[key] ?? key,
      width: WIDTHS[key] ?? 140,
      frozen: key === 'email',
      editable: (row: GridRow) => canEdit(row, key),
      renderEditCell: isConsentKey(key) ? CustomersBulkSelectEditor : renderTextEditor,
      renderCell: ({ row }) => {
        let text = String((row as Record<string, unknown>)[key] ?? '')
        if (key === 'email') text = row.email || copy.noEmail
        else if (isConsentKey(key)) text = row[key] === 'yes' ? copy.consent.yes : copy.consent.no
        else if (key === 'city' && !row.address) text = copy.noAddress
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
