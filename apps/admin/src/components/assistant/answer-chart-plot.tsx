'use client'

import type { AnswerTable, ReportColumnKind } from '@commerce/api'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { formatAxis, formatCell } from '@/lib/report-format'

type AnswerChartPlotProps = {
  table: AnswerTable
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted-foreground)' }
const LABEL_MAX = 14

function shorten(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text
}

function kindOf(table: AnswerTable, id: string): ReportColumnKind {
  return table.columns.find((c) => c.id === id)?.kind ?? 'count'
}

/**
 * The chart of an `AnswerChart`, which holds its height while recharts loads: a line over days
 * or months, or bars by category. Same chart pieces and colours as the report page's chart.
 */
export default function AnswerChartPlot({ table }: AnswerChartPlotProps) {
  // Hooks
  const columns = useCopy(analyticsContent.reports.columns)

  // Early returns
  const chart = table.chart
  if (!chart) return null

  // Render logic
  const xKind = kindOf(table, chart.x)
  const yKind = kindOf(table, chart.y)
  const label = columns[chart.y] ?? chart.y
  const points = table.rows.map((r) => ({
    label: shorten(formatCell(xKind, r.values[chart.x] ?? null)),
    value: typeof r.values[chart.y] === 'number' ? Number(r.values[chart.y]) : 0,
  }))
  const config = { value: { label, color: 'var(--chart-1)' } } satisfies ChartConfig
  const tooltip = (
    <ChartTooltipContent
      formatter={(v) => (
        <span className="flex w-full items-center justify-between gap-3">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-bold tabular-nums">{formatCell(yKind, Number(v))}</span>
        </span>
      )}
    />
  )
  const xAxis = (
    <XAxis
      dataKey="label"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      tick={AXIS_TICK}
      minTickGap={12}
    />
  )
  const yAxis = (
    <YAxis
      tickLine={false}
      axisLine={false}
      width={52}
      tick={AXIS_TICK}
      tickFormatter={(v: number) => formatAxis(yKind, v)}
    />
  )

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      {chart.kind === 'bar' ? (
        <BarChart data={points} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border-soft)" />
          {xAxis}
          {yAxis}
          <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={tooltip} />
          <Bar
            dataKey="value"
            fill="var(--chart-1)"
            radius={3}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      ) : (
        <AreaChart data={points} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="answer-area-fill" x1="0" y1="0" x2="0" y2="1">
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
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#answer-area-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      )}
    </ChartContainer>
  )
}
