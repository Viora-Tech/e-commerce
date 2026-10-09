import { cn } from '@commerce/ui/lib/utils'
import { TableRow } from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'

type SettingsTableRowProps = {
  children: ReactNode
  className?: string
}

/** A body row of a settings table; carries `group/row` so `RowActionsCell` can brighten on hover. */
export default function SettingsTableRow({ children, className }: SettingsTableRowProps) {
  return <TableRow className={cn('group/row', className)}>{children}</TableRow>
}
