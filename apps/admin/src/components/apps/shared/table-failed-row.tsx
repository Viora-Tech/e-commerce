'use client'

import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import TableFeedback from '@/components/table/resource-table/table-feedback'

type TableFailedRowProps = {
  colSpan: number
  /** "Could not load the …", the app's own words. */
  heading: string
  onRetry: () => void
}

/**
 * A plain app table's body when its rows could not be read: the list table's failed state
 * (`TableFeedback`, "Could not load the …" with Try again) across every column, under the header,
 * instead of an empty table or a toast over old rows.
 */
export default function TableFailedRow({ colSpan, heading, onRetry }: TableFailedRowProps) {
  // Render logic
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <TableFeedback kind="error" plural="" words={{ heading }} onRetry={onRetry} />
      </TableCell>
    </TableRow>
  )
}
