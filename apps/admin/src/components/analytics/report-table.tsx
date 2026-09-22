import type { ReportDefinition, ReportRow } from '@commerce/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { analyticsContent as copy } from '@/data/analytics'
import { formatDay } from '@/lib/analytics-range'
import { formatPaise } from '@/lib/money'

type ReportTableProps = {
  report: ReportDefinition
  rows: ReportRow[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const NUMERIC = new Set(['orders', 'units', 'revenue'])

/** Day rows read as dates; everything else is already a name. */
function labelOf(row: ReportRow): string {
  return ISO_DATE.test(row.label) ? formatDay(row.label) : row.label
}

function cellOf(row: ReportRow, column: ReportDefinition['columns'][number]): string {
  if (column === 'label') return labelOf(row)
  if (column === 'detail') return row.detail ?? '-'
  if (column === 'orders') return String(row.orders)
  if (column === 'units') return row.units === null ? '-' : String(row.units)
  return formatPaise(row.revenuePaise)
}

/** The rows behind a report, in the columns that report declares. */
export default function ReportTable({ report, rows }: ReportTableProps) {
  // Early returns
  if (rows.length === 0) {
    return <p className="text-kit-body text-muted-foreground">{copy.reports.empty}</p>
  }

  // Render logic
  const c = copy.reports.columns

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {report.columns.map((column) => (
            <TableHead key={column} className={NUMERIC.has(column) ? 'text-right' : undefined}>
              {c[column]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            {report.columns.map((column) => (
              <TableCell
                key={column}
                className={NUMERIC.has(column) ? 'text-right tabular-nums' : undefined}
              >
                {cellOf(row, column)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
