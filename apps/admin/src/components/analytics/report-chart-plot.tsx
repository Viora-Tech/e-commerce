'use client'

import type { ReportColumnKind } from '@commerce/api'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { formatAxis, formatCell } from '@/lib/report-format'

type ReportChartPlotProps = {
  points: { label: string; value: number; previous: number | null }[]
  /** The metric's name, and how its values read. */
  label: string | undefined
  previousLabel: string
  kind: ReportColumnKind
  hasPrevious: boolean
  /** Bars rather than a line. */
  bars: boolean
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }

/** The picture of a `ReportChart`, which holds its height while recharts loads. */
export default function ReportChartPlot({
  points,
  label,
  previousLabel,
  kind,
  hasPrevious,
  bars,
}: ReportChartPlotProps) {
  // Render logic
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
          <span className="font-bold tabular-nums">{formatCell(kind, Number(v))}</span>
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
      tickFormatter={(v: number) => formatAxis(kind, v)}
    />
  )
  const xAxis = (
    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} tick={AXIS_TICK} />
  )

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      {bars ? (
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
  )
}
