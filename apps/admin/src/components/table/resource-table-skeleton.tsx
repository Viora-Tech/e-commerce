import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@commerce/ui/shadcn/table'
import {
  CELL,
  CONTROL_HEIGHT,
  HEAD,
  SKELETON_ROWS,
  TOOLBAR_ROW,
} from '@/components/table/resource-table/styles'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'

type ResourceTableSkeletonProps = {
  /** Columns, the selection box first. */
  columns?: number
  rows?: number
  /** Read out over the rows ("Loading orders"). */
  label?: string
}

/**
 * The list table's card while a route loads and the page's own columns are not known: the
 * toolbar row, the header row and the rows, drawn with ResourceTable's own measurements
 * (`resource-table/styles`), so the card does not grow or shrink when the table arrives. A page
 * that knows its columns renders the real `ResourceTable` with `loading` instead.
 */
export default function ResourceTableSkeleton({
  columns = 6,
  rows = SKELETON_ROWS,
  label = '',
}: ResourceTableSkeletonProps) {
  // Render logic
  return (
    <Card gap="none" inset="y-none" className="overflow-hidden" aria-busy="true">
      <div className="flex flex-col border-border border-b">
        <div className={TOOLBAR_ROW}>
          <span className={cn('flex items-center px-2.5', CONTROL_HEIGHT)}>
            <Skeleton className="h-3.5 w-24" />
          </span>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          <span className={cn('flex min-w-0 flex-1 items-center px-2', CONTROL_HEIGHT)}>
            <Skeleton className="h-3.5 w-48 max-w-full" />
          </span>
          <span className={cn('flex items-center gap-1', CONTROL_HEIGHT)}>
            <Skeleton className="size-5" />
            <Skeleton className="size-5" />
          </span>
        </div>
      </div>
      <Table className="w-full table-fixed border-separate border-spacing-0">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }, (_, i) => (
              <TableHead key={`head-${i.toString()}`} className={cn(HEAD, i === 0 && 'w-10')} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows columns={columns} rows={rows} cellClassName={CELL} label={label} />
        </TableBody>
      </Table>
    </Card>
  )
}
