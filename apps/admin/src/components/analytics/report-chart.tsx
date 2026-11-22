'use client'

import type { ReportColumn, ReportDefinition, ReportResult } from '@commerce/api'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'
import DataCard from '@/components/layout/data-card'
import DeltaChip from '@/components/layout/delta-chip'
import EmptyState from '@/components/layout/empty-state'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { formatDay } from '@/lib/analytics-range'
import { change, formatCell, LOWER_IS_BETTER } from '@/lib/report-format'

type ReportChartProps = {
  /** Overrides the shape the report declares (the Bar / Line switch). */
  shape?: ReportDefinition['chart']
  report: ReportDefinition
  data: ReportResult
}

const LABEL_MAX = 18
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/* recharts is large: it loads only where a chart is drawn. */
const ReportChartPlot = dynamic(() => import('./report-chart-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

function shorten(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text
}

/** The metric's column, or a money column for reports whose chart is a daily sales line. */
function metricColumn(report: ReportDefinition): ReportColumn {
  return report.columns.find((c) => c.id === report.metric) ?? { id: report.metric, kind: 'money' }
}

/**
 * The picture above the table: a line across the range with the previous period
 * dashed behind it, or the top rows as bars. The headline is the metric total
 * and its change.
 */
export default function ReportChart({ report, data, shape }: ReportChartProps) {
  // Hooks
  const copy = useCopy(analyticsContent)

  // Render logic
  const c = copy.reports
  const metric = metricColumn(report)
  const first = report.columns[0] as ReportColumn
  /* A report whose rows are not days (gross to net) charts daily total sales instead. */
  const ownSeries = !(metric.id in data.totals)
  const label = ownSeries ? c.columns.totalSales : (c.columns[metric.id] ?? metric.id)
  const previousLabel = c.previous
  const points = data.chart.map((p) => ({
    label: shorten(formatCell(ISO_DATE.test(p.label) ? 'date' : first.kind, p.label)),
    value: p.value,
    previous: p.previous,
  }))
  const hasPrevious = data.previousTotals !== null && points.some((p) => p.previous !== null)
  const total = ownSeries ? points.reduce((n, p) => n + p.value, 0) : data.totals[metric.id]
  const previousTotal = ownSeries
    ? points.reduce((n, p) => n + (p.previous ?? 0), 0)
    : data.previousTotals?.[metric.id]

  return (
    <DataCard
      meta={label}
      title={
        <span className="flex items-baseline gap-2 tabular-nums">
          {total === undefined ? '' : formatCell(metric.kind, total)}
          {data.previousTotals ? (
            <DeltaChip
              delta={change(total, previousTotal)}
              invert={LOWER_IS_BETTER.has(metric.id)}
            />
          ) : null}
        </span>
      }
      action={
        <p className="text-caption text-muted-foreground">
          {data.previousRange
            ? c.comparedWith(formatDay(data.previousRange.from), formatDay(data.previousRange.to))
            : c.snapshot}
        </p>
      }
    >
      {points.length === 0 ? (
        <EmptyState variant="inline" body={c.empty} />
      ) : (
        <div className="h-[16rem] w-full">
          <ReportChartPlot
            points={points}
            label={label}
            previousLabel={previousLabel}
            kind={metric.kind}
            hasPrevious={hasPrevious}
            bars={(shape ?? report.chart) === 'bars'}
          />
        </div>
      )}
    </DataCard>
  )
}
