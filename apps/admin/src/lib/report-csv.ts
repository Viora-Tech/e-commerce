import type { ReportDefinition, ReportResult } from '@commerce/api'
import { analyticsContent } from '@/data/analytics'
import { downloadCsv, toCsv } from '@/lib/csv'
import { csvCell } from '@/lib/report-format'

/** Header, CSV rows and totals row for the export; the metric's previous value rides along. */
export function csvOf(report: ReportDefinition, data: ReportResult): string {
  const c = analyticsContent.reports
  const metric = report.columns.find((col) => col.id === report.metric)
  const compare = data.previousTotals !== null && metric !== undefined
  const headers = [
    ...report.columns.map((col) => c.columns[col.id] ?? col.id),
    ...(compare ? [`${c.columns[metric.id] ?? metric.id} (${c.previous})`] : []),
  ]
  const rows = data.rows.map((row) => [
    ...report.columns.map((col) => csvCell(col.kind, row.values[col.id])),
    ...(compare ? [csvCell(metric.kind, row.previous)] : []),
  ])
  if (Object.keys(data.totals).length > 0) {
    rows.push([
      ...report.columns.map((col, i) =>
        i === 0 ? c.totals : csvCell(col.kind, data.totals[col.id]),
      ),
      ...(compare ? [csvCell(metric.kind, data.previousTotals?.[metric.id])] : []),
    ])
  }
  return toCsv(headers, rows)
}

/** Saves a report's rows as a CSV file. */
export function downloadReportCsv(name: string, report: ReportDefinition, data: ReportResult) {
  downloadCsv(name, csvOf(report, data))
}
