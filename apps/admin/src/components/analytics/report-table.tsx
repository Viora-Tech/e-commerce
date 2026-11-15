import type { ReportColumn, ReportDefinition, ReportResult } from '@commerce/api'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import DeltaChip from '@/components/layout/delta-chip'
import EmptyState from '@/components/layout/empty-state'
import SimpleTable, { type SimpleTableColumn } from '@/components/table/simple-table'
import { analyticsContent as copy } from '@/data/analytics'
import { change, formatCell, isNumericKind, LOWER_IS_BETTER } from '@/lib/report-format'

type ReportTableProps = {
  report: ReportDefinition
  data: ReportResult
}

const alignOf = (column: ReportColumn) =>
  isNumericKind(column.kind) ? 'text-right tabular-nums' : undefined

const alignTo = (column: ReportColumn): SimpleTableColumn['align'] =>
  isNumericKind(column.kind) ? 'end' : 'start'

/** The rows behind a report in the columns it declares, the metric compared with the period before. */
export default function ReportTable({ report, data }: ReportTableProps) {
  // Early returns
  if (data.rows.length === 0) {
    return <EmptyState variant="inline" body={copy.reports.empty} />
  }

  // Render logic
  const c = copy.reports
  const compare = data.previousTotals !== null
  const metric = report.columns.find((col) => col.id === report.metric)
  const invert = LOWER_IS_BETTER.has(report.metric)
  const hasTotals = Object.keys(data.totals).length > 0
  const columns: SimpleTableColumn[] = [
    ...report.columns.map((column) => ({
      key: column.id,
      label: c.columns[column.id] ?? column.id,
      align: alignTo(column),
    })),
    ...(compare && metric
      ? [
          { key: 'previous', label: c.previous, align: 'end' as const },
          { key: 'change', label: c.change, align: 'end' as const },
        ]
      : []),
  ]
  const footer = hasTotals ? (
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
  ) : undefined

  return (
    <SimpleTable density="compact" columns={columns} footer={footer}>
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
    </SimpleTable>
  )
}
