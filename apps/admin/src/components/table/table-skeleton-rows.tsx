import { cn } from '@commerce/ui/lib/utils'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'

type TableSkeletonRowsProps = {
  /** Cells per row: the table's column count. */
  columns: number
  rows?: number
  /** The table's own cell classes, so the placeholder rows are as tall as real ones. */
  cellClassName?: string
  /** Read out while the rows load ("Loading invoices"). */
  label: string
}

/**
 * Placeholder rows for a plain table body while its page loads, the same bars the shared list
 * table draws. The first column (a checkbox) gets a small square.
 */
export default function TableSkeletonRows({
  columns,
  rows = 6,
  cellClassName,
  label,
}: TableSkeletonRowsProps) {
  // Render logic
  return Array.from({ length: rows }, (_, i) => (
    <TableRow
      key={`skeleton-${i.toString()}`}
      className="hover:bg-transparent"
      aria-busy="true"
      aria-label={i === 0 ? label : undefined}
    >
      {Array.from({ length: columns }, (_, j) => (
        <TableCell key={`skeleton-${i.toString()}-${j.toString()}`} className={cellClassName}>
          <Skeleton className={cn('h-3.5', j === 0 ? 'w-4' : 'w-full max-w-32')} />
        </TableCell>
      ))}
    </TableRow>
  ))
}
