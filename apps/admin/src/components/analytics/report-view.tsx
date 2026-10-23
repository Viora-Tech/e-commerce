'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import { Bookmark, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import StatusChip from '@/components/layout/status-chip'
import { analyticsContent } from '@/data/analytics'
import { type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import { csvOf } from '@/lib/report-csv'
import { routes } from '@/lib/routes'
import ProfitInsightsCard from './profit-insights-card'
import RangePicker from './range-picker'
import ReportChart from './report-chart'
import ReportNameDialog from './report-name-dialog'
import ReportTable from './report-table'

type ReportViewProps = {
  report: ReportDefinition
  initialRange: RangeState
  initial: ReportResult
}

type Shape = ReportDefinition['chart']

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
  const [saving, setSaving] = useState(false)

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

  const handleSave = async (name: string) => {
    try {
      await api.analytics.saveReport({ name, reportSlug: report.slug, range })
      toast.success(analyticsContent.reports.save.saved)
      setSaving(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  const handleExport = () => {
    const span = report.ranged ? `${data.range.from}-to-${data.range.to}` : data.range.to
    downloadCsv(`${report.slug}-${span}.csv`, csvOf(report, data))
  }

  // Render logic
  const c = analyticsContent.reports

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      <PageHeader
        title={report.title}
        summary={report.description}
        back={{ label: c.back, href: routes.analytics.reports() }}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              {c.export}
            </Button>
            <Button onClick={() => setSaving(true)}>
              <Bookmark aria-hidden />
              {c.save.button}
            </Button>
          </>
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
      {data.profit ? <ProfitInsightsCard insights={data.profit} /> : null}
      <ReportChart report={report} data={data} shape={shape} />
      {saving ? (
        <ReportNameDialog
          title={c.save.title}
          description={c.save.help}
          confirm={c.save.confirm}
          initialName={report.title}
          onCancel={() => setSaving(false)}
          onConfirm={handleSave}
        />
      ) : null}
      <DataCard title={c.details}>
        <ReportTable report={report} data={data} />
      </DataCard>
    </div>
  )
}
