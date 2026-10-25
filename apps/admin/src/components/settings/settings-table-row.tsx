import { cn } from '@commerce/ui/lib/utils'
import { TableRow } from '@commerce/ui/shadcn/table'
import type { CSSProperties, ReactNode, Ref } from 'react'

type SettingsTableRowProps = {
  children: ReactNode
  className?: string
  /** For a row that drags (a sortable's node ref and transform). */
  ref?: Ref<HTMLTableRowElement>
  style?: CSSProperties
}

/** A body row of a settings table; carries `group/row` so `RowActionsCell` can brighten on hover. */
export default function SettingsTableRow({
  children,
  className,
  ref,
  style,
}: SettingsTableRowProps) {
  return (
    <TableRow ref={ref} style={style} className={cn('group/row', className)}>
      {children}
    </TableRow>
  )
}
