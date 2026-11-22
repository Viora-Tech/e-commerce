'use client'

import type { ReportDefinition, ReportResult } from '@commerce/api'
import { Bookmark, Download } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import NameDialog from '@/components/fields/name-dialog'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import StatusChip from '@/components/layout/status-chip'
import { analyticsContent } from '@/data/analytics'
import type { LoadFailure } from '@/hooks/use-load'
import { type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import { isForbidden } from '@/lib/forbidden'
import { csvOf } from '@/lib/report-csv'
import { routes } from '@/lib/routes'
import ProfitInsightsCard from './profit-insights-card'
import RangeFailed from './range-failed'
import RangePicker from './range-picker'
import ReportChart from './report-chart'
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
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the read (Try again)
  useEffect(() => {
    setFailed(false)
    if (sameRange(range, initialRange)) {
      setData(initial)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    api.analytics
      .report({ slug: report.slug, range })
      .then((next) => {
        if (live) setData(next)
      })
      .catch((err: unknown) => {
        if (live) setFailed(isForbidden(err) ? 'no-access' : 'error')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [range, initialRange, initial, report.slug, attempt])

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
  const understood = report.ranged || Boolean(data.previousTotals)

  return (
    <PageBody>
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
      {/* The controls row, like the overview's range row: dates and comparison on the left
          (headed "What I understood" only when they are there, audit #51), the chart shape on
          the right. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {understood ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-caption text-muted-foreground">{c.understood}</span>
            {report.ranged ? <RangePicker value={range} onChange={handleRange} /> : null}
            {data.previousTotals ? (
              <span className="flex items-center gap-2 text-caption text-muted-foreground">
                {c.compareLabel}
                <StatusChip>{c.previous}</StatusChip>
              </span>
            ) : null}
          </div>
        ) : (
          <span />
        )}
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
      {failed ? (
        <RangeFailed
          failed={failed}
          heading={c.loadFailed}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : (
        /* The figures dim while the new range loads, so the old ones are not read as new. */
        <div
          aria-busy={loading || undefined}
          className={cn(
            'flex flex-col gap-6 transition-opacity duration-150',
            loading && 'pointer-events-none opacity-50',
          )}
        >
          {data.profit ? <ProfitInsightsCard insights={data.profit} /> : null}
          <ReportChart report={report} data={data} shape={shape} />
          <DataCard title={c.details}>
            <ReportTable report={report} data={data} />
          </DataCard>
        </div>
      )}
      {saving ? (
        <NameDialog
          title={c.save.title}
          description={c.save.help}
          label={c.save.name}
          cancelLabel={c.save.cancel}
          maxLength={120}
          submitLabel={c.save.confirm}
          initialName={report.title}
          onCancel={() => setSaving(false)}
          onSubmit={handleSave}
        />
      ) : null}
    </PageBody>
  )
}
