import type { ReportColumn, ReportDefinition, ReportResult } from '@commerce/api'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DeltaChip from '@/components/layout/delta-chip'
import { analyticsContent as copy } from '@/data/analytics'
import { change, formatCell, isNumericKind, LOWER_IS_BETTER } from '@/lib/report-format'

type ReportTableProps = {
  report: ReportDefinition
  data: ReportResult
}

const alignOf = (column: ReportColumn) =>
  isNumericKind(column.kind) ? 'text-right tabular-nums' : undefined

/** The rows behind a report in the columns it declares, the metric compared with the period before. */
export default function ReportTable({ report, data }: ReportTableProps) {
  // Early returns
  if (data.rows.length === 0) {
    return <p className="text-kit-body text-muted-foreground">{copy.reports.empty}</p>
  }

  // Render logic
  const c = copy.reports
  const compare = data.previousTotals !== null
  const metric = report.columns.find((col) => col.id === report.metric)
  const invert = LOWER_IS_BETTER.has(report.metric)
  const hasTotals = Object.keys(data.totals).length > 0

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {report.columns.map((column) => (
            <TableHead key={column.id} className={alignOf(column)}>
              {c.columns[column.id] ?? column.id}
            </TableHead>
          ))}
          {compare && metric ? (
            <>
              <TableHead className="text-right">{c.previous}</TableHead>
              <TableHead className="text-right">{c.change}</TableHead>
            </>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.rows.map((row) => (
          <TableRow key={row.key}>
            {report.columns.map((column) => (
              <TableCell key={column.id} className={alignOf(column)}>
                {formatCell(column.kind, row.values[column.id])}
              </TableCell>
            ))}
            {compare && metric ? (
              <>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {formatCell(metric.kind, row.previous)}
                </TableCell>
                <TableCell className="text-right">
                  <DeltaChip delta={change(row.values[metric.id], row.previous)} invert={invert} />
                </TableCell>
              </>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
      {hasTotals ? (
        <TableFooter>
          <TableRow>
            {report.columns.map((column, i) => (
              <TableCell key={column.id} className={alignOf(column)}>
                {i === 0
                  ? c.totals
                  : column.id in data.totals
                    ? formatCell(column.kind, data.totals[column.id])
                    : ''}
              </TableCell>
            ))}
            {compare && metric ? (
              <>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {formatCell(metric.kind, data.previousTotals?.[metric.id])}
                </TableCell>
                <TableCell className="text-right">
                  <DeltaChip
                    delta={change(data.totals[metric.id], data.previousTotals?.[metric.id])}
                    invert={invert}
                  />
                </TableCell>
              </>
            ) : null}
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  )
}
