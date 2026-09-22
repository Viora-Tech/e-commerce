'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import { ArrowLeft, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import ChartCard from '@/components/layout/chart-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent as copy } from '@/data/analytics'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatPaise, formatPaiseCompact } from '@/lib/money'
import RangePicker from './range-picker'
import ReportTable from './report-table'

type ReportViewProps = {
  report: ReportDefinition
  initialRange: RangeState
  initial: ReportResult
}

/** A single report: range picker, revenue curve, the table and a CSV export. */
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
    const c = copy.reports.columns
    const headers = report.columns.map((id) => c[id])
    const rows = data.rows.map((row) =>
      report.columns.map((id) => {
        if (id === 'label') return row.label
        if (id === 'detail') return row.detail ?? ''
        if (id === 'orders') return row.orders
        if (id === 'units') return row.units ?? ''
        return (row.revenuePaise / 100).toFixed(2)
      }),
    )
    downloadCsv(`${report.slug}-${data.range.from}-to-${data.range.to}.csv`, toCsv(headers, rows))
  }

  // Render logic
  const points = data.chart.map((p) => ({ ...p, label: formatDay(p.label) }))

  return (
    <PageBody width="frame" className="gap-5">
      <PageHeader
        title={report.title}
        subtitle={report.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker value={range} onChange={handleRange} />
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
      <ChartCard
        title={copy.salesOverTime.title}
        periods={[{ id: 'day', label: copy.salesOverTime.day, data: points }]}
        seriesKey={`${report.slug}-${range.key}`}
        seriesLabel={copy.salesOverTime.series}
        formatValue={formatPaiseCompact}
      />
      <Card className="gap-0 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-kit-title text-foreground">{report.title}</p>
          <p className="text-kit-body text-muted-foreground tabular-nums">
            {copy.reports.totals}: {data.totals.orders} / {formatPaise(data.totals.revenuePaise)}
          </p>
        </div>
        <div className="mt-5">
          <ReportTable report={report} rows={data.rows} />
        </div>
      </Card>
    </PageBody>
  )
}
