import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type KitTableProps = { children: ReactNode; className?: string }

/**
 * Sheet 14:1006 table shell. Rows are CSS-grid `<div>` rows so the header band
 * (14:1007) and body rows (14:1022) share one column template passed via
 * `--kit-cols`; children are `KitTableHead` / `KitTableRow`.
 */
export default function KitTable({ children, className }: KitTableProps) {
  // Render logic
  return <div className={cn('flex w-full flex-col', className)}>{children}</div>
}
