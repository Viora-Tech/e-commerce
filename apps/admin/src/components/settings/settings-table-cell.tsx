import { cn } from '@commerce/ui/lib/utils'
import { TableCell } from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'
import { SETTINGS_CELL } from './settings-table'

type SettingsTableCellProps = {
  children?: ReactNode
  center?: boolean
  className?: string
}

/** A body cell at the settings table's density. */
export default function SettingsTableCell({ children, center, className }: SettingsTableCellProps) {
  return (
    <TableCell className={cn(SETTINGS_CELL, center && 'text-center', className)}>
      {children}
    </TableCell>
  )
}
