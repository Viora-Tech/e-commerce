'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import { ArrowLeft, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent as copy } from '@/data/analytics'
import { type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { csvCell } from '@/lib/report-format'
import RangePicker from './range-picker'
import ReportChart from './report-chart'
import ReportTable from './report-table'

type ReportViewProps = {
  report: ReportDefinition
  initialRange: RangeState
  initial: ReportResult
}

/** Header, CSV rows and totals row for the export; the metric's previous value rides along. */
function csvOf(report: ReportDefinition, data: ReportResult): string {
  const c = copy.reports
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

/** A single report: range picker, chart with the previous period, the table and a CSV export. */
export default function ReportView({ report, initialRange, initial }: ReportViewProps) {
  // Hooks
  const [range, setRange] = useState(initialRange)
  const [data, setData] = useState(initial)

  useEffect(() => {
    if (sameRange(range, initialRange)) {
      setData(initial)
      return
    }
    let live = true
    api.analytics.report({ slug: report.slug, range }).then((next) => {
      if (live) setData(next)
    })
    return () => {
      live = false
    }
  }, [range, initialRange, initial, report.slug])

  // Event handlers
  const handleRange = (next: RangeState) => {
    setRange(next)
    window.history.replaceState(null, '', `/analytics/reports/${report.slug}${rangeQuery(next)}`)
  }

  const handleExport = () => {
    const span = report.ranged ? `${data.range.from}-to-${data.range.to}` : data.range.to
    downloadCsv(`${report.slug}-${span}.csv`, csvOf(report, data))
  }

  return (
    <PageBody width="frame" className="gap-5">
      <PageHeader
        title={report.title}
        subtitle={report.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {report.ranged ? <RangePicker value={range} onChange={handleRange} /> : null}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4" />
              {copy.reports.export}
            </Button>
          </div>
        }
      />
      <Link
        href="/analytics/reports"
        className="inline-flex w-fit items-center gap-1 text-kit-mini text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {copy.reports.back}
      </Link>
      <ReportChart report={report} data={data} />
      <Card className="gap-0 p-5">
        <p className="text-kit-title text-foreground">{report.title}</p>
        <div className="mt-5">
          <ReportTable report={report} data={data} />
        </div>
      </Card>
    </PageBody>
  )
}
