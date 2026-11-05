'use client'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@commerce/ui/shadcn/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { type ChartPoint, chartConfig } from './chart-config'

type ChartCardPlotProps = {
  data: ChartPoint[]
  /** The last point is a period still running: drawn as a dashed line. */
  partial: boolean
  seriesLabel?: string | undefined
  formatValue: (n: number) => string
}

type Row = { label: string; value?: number | undefined; live?: number | undefined }

/**
 * The solid series stops at the last finished point; `live` carries that point and the running
 * one, so the dashed piece joins on. A single point (Today) is all live, drawn as a dot.
 */
function splitLive(data: ChartPoint[], partialLast: boolean): Row[] {
  const n = data.length
  if (!partialLast || n === 0) return data
  return data.map((p, i) => ({
    label: p.label,
    value: i === n - 1 && n > 1 ? undefined : p.value,
    live: i >= n - 2 ? p.value : undefined,
  }))
}

/** The area chart of a `ChartCard`, which holds its height while recharts loads. */
export default function ChartCardPlot({
  data: points,
  partial,
  seriesLabel,
  formatValue,
}: ChartCardPlotProps) {
  // Render logic
  const data = splitLive(points, partial)
  const config = seriesLabel ? { value: { ...chartConfig.value, label: seriesLabel } } : chartConfig

  return (
    <ChartContainer
      config={config}
      className="aspect-auto size-full [&_.recharts-area-area]:animate-in [&_.recharts-area-area]:fade-in [&_.recharts-area-area]:duration-700 [&_.recharts-area-curve]:animate-draw motion-reduce:[&_.recharts-area-area]:animate-none motion-reduce:[&_.recharts-area-curve]:animate-none"
    >
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="0" stroke="var(--border-soft)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tick={{ fontSize: 14, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v: number) => formatValue(v)}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--chart-1)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(v, name, item) =>
                // The joining point carries both series; list it once.
                name === 'live' && (item.payload as Row).value !== undefined ? null : (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">{seriesLabel ?? String(name)}</span>
                    <span className="font-bold tabular-nums">{formatValue(Number(v))}</span>
                  </span>
                )
              }
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#chart-area-fill)"
          isAnimationActive={false}
          activeDot={{ r: 5, fill: 'var(--chart-1)', strokeWidth: 0 }}
        />
        {partial ? (
          <Area
            dataKey="live"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeDasharray="4 4"
            fill="none"
            isAnimationActive={false}
            dot={data.length === 1 ? { r: 4, fill: 'var(--chart-1)', strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: 'var(--chart-1)', strokeWidth: 0 }}
          />
        ) : null}
      </AreaChart>
    </ChartContainer>
  )
}
