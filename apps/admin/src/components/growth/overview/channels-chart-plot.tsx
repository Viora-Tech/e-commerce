'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

type ChannelsChartPlotProps = {
  points: { label: string; value: number }[]
  /** Nothing tracked yet: the usual channels at zero, with no tooltip. */
  flat: boolean
  /** The metric's name, for the tooltip. */
  label: string
  format: (n: number) => string
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }

/** The bars of `ChannelsChartCard`, which holds their height while recharts loads. */
export default function ChannelsChartPlot({ points, flat, label, format }: ChannelsChartPlotProps) {
  // Render logic
  const config = { value: { label, color: 'var(--chart-1)' } } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <BarChart data={points} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--border-soft)" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          allowDecimals={false}
          tick={AXIS_TICK}
          domain={flat ? [0, 1] : [0, 'auto']}
          ticks={flat ? [0] : undefined}
          tickFormatter={(v: number) => format(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={104}
          tick={AXIS_TICK}
        />
        {flat ? null : (
          <ChartTooltip
            cursor={{ fill: 'var(--muted)' }}
            content={
              <ChartTooltipContent
                hideIndicator
                formatter={(v) => (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">{format(Number(v))}</span>
                  </span>
                )}
              />
            }
          />
        )}
        <Bar
          dataKey="value"
          fill="var(--chart-1)"
          radius={4}
          maxBarSize={22}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}
