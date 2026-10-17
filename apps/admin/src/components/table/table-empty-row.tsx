import { TableCell, TableRow } from '@commerce/ui/shadcn/table'

type TableEmptyRowProps = {
  colSpan: number
  message: string
}

/** The one-line "nothing here" row of a table body. */
export default function TableEmptyRow({ colSpan, message }: TableEmptyRowProps) {
  // Render logic
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  )
}
