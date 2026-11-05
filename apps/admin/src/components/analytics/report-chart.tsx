'use client'

import type { ReportColumn, ReportDefinition, ReportResult } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'
import DeltaChip from '@/components/layout/delta-chip'
import { analyticsContent as copy } from '@/data/analytics'
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
    <Card gap="none" inset={5}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-kit-mini text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-kit-title text-foreground tabular-nums">
              {total === undefined ? '' : formatCell(metric.kind, total)}
            </p>
            {data.previousTotals ? (
              <DeltaChip
                delta={change(total, previousTotal)}
                invert={LOWER_IS_BETTER.has(metric.id)}
              />
            ) : null}
          </div>
        </div>
        <p className="text-kit-mini text-muted-foreground">
          {data.previousRange
            ? c.comparedWith(formatDay(data.previousRange.from), formatDay(data.previousRange.to))
            : c.snapshot}
        </p>
      </div>
      {points.length === 0 ? (
        <p className="mt-6 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="mt-6 h-[16rem] w-full">
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
    </Card>
  )
}
