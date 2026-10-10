'use client'

import type { ReportColumn, ReportDefinition, ReportResult } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import DeltaChip from '@/components/layout/delta-chip'
import { analyticsContent as copy } from '@/data/analytics'
import { formatDay } from '@/lib/analytics-range'
import { change, formatAxis, formatCell, LOWER_IS_BETTER } from '@/lib/report-format'

type ReportChartProps = {
  /** Overrides the shape the report declares (the Bar / Line switch). */
  shape?: ReportDefinition['chart']
  report: ReportDefinition
  data: ReportResult
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }
const LABEL_MAX = 18
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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
  const config = {
    value: { label, color: 'var(--chart-1)' },
    previous: { label: previousLabel, color: 'var(--chart-5)' },
  } satisfies ChartConfig
  const tooltip = (
    <ChartTooltipContent
      formatter={(v, name) => (
        <span className="flex w-full items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {name === 'previous' ? previousLabel : label}
          </span>
          <span className="font-bold tabular-nums">{formatCell(metric.kind, Number(v))}</span>
        </span>
      )}
    />
  )
  const yAxis = (
    <YAxis
      tickLine={false}
      axisLine={false}
      width={72}
      tick={AXIS_TICK}
      tickFormatter={(v: number) => formatAxis(metric.kind, v)}
    />
  )
  const xAxis = (
    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} tick={AXIS_TICK} />
  )

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
        <ChartContainer config={config} className="mt-6 aspect-auto h-[16rem] w-full">
          {(shape ?? report.chart) === 'bars' ? (
            <BarChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-soft)" />
              {xAxis}
              {yAxis}
              <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={tooltip} />
              {hasPrevious ? (
                <Bar
                  dataKey="previous"
                  fill="var(--chart-5)"
                  fillOpacity={0.35}
                  radius={4}
                  maxBarSize={48}
                />
              ) : null}
              <Bar
                dataKey="value"
                fill="var(--chart-1)"
                radius={4}
                maxBarSize={48}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <ComposedChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="report-area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border-soft)" />
              {xAxis}
              {yAxis}
              <ChartTooltip
                cursor={{ stroke: 'var(--chart-1)', strokeDasharray: '4 4' }}
                content={tooltip}
              />
              {hasPrevious ? (
                <Line
                  dataKey="previous"
                  type="monotone"
                  stroke="var(--chart-5)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#report-area-fill)"
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          )}
        </ChartContainer>
      )}
    </Card>
  )
}
