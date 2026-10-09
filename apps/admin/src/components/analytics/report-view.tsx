'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import StatusChip from '@/components/layout/status-chip'
import { analyticsContent } from '@/data/analytics'
import { type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'
import { csvCell } from '@/lib/report-format'
import { routes } from '@/lib/routes'
import RangePicker from './range-picker'
import ReportChart from './report-chart'
import ReportTable from './report-table'

type ReportViewProps = {
  report: ReportDefinition
  initialRange: RangeState
  initial: ReportResult
}

type Shape = ReportDefinition['chart']

/** Header, CSV rows and totals row for the export; the metric's previous value rides along. */
function csvOf(report: ReportDefinition, data: ReportResult): string {
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

/**
 * A single report in the layout of Figma "Reports · AI query": the "What I understood" card
 * (date range and comparison, wired to the report engine), the chart with a Bar / Line switch,
 * the details table and the CSV export. Saved reports, schedules and the AI summary need a
 * backend that does not exist yet and are left out.
 */
export default function ReportView({ report, initialRange, initial }: ReportViewProps) {
  // Hooks
  const [range, setRange] = useState(initialRange)
  const [data, setData] = useState(initial)
  const [shape, setShape] = useState<Shape>(report.chart)

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
    window.history.replaceState(
      null,
      '',
      `${routes.analytics.report(report.slug)}${rangeQuery(next)}`,
    )
  }

  const handleExport = () => {
    const span = report.ranged ? `${data.range.from}-to-${data.range.to}` : data.range.to
    downloadCsv(`${report.slug}-${span}.csv`, csvOf(report, data))
  }

  // Render logic
  const c = analyticsContent.reports

  return (
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader
        title={report.title}
        summary={report.description}
        back={{ label: c.back, href: routes.analytics.reports() }}
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" />
            {c.export}
          </Button>
        }
      />
      <Card gap="none" inset={5}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground">{c.understood}</p>
          <PillTabs
            variant="segmented"
            value={shape}
            onChange={(next) => setShape(next ?? report.chart)}
            tabs={[
              { value: 'bars' as Shape, label: c.chartType.bars },
              { value: 'series' as Shape, label: c.chartType.line },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {report.ranged ? <RangePicker value={range} onChange={handleRange} /> : null}
          {data.previousTotals ? (
            <span className="flex items-center gap-2 text-caption text-muted-foreground">
              {c.compareLabel}
              <StatusChip>{c.previous}</StatusChip>
            </span>
          ) : null}
        </div>
      </Card>
      <ReportChart report={report} data={data} shape={shape} />
      <Card gap="none" inset={5}>
        <p className="text-card-title text-ink-strong">{c.details}</p>
        <div className="mt-5">
          <ReportTable report={report} data={data} />
        </div>
      </Card>
    </div>
  )
}
