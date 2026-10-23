'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

/** One line on the chart. The first non-dashed series is drawn as a filled area. */
export type TrendSeries = {
  key: string
  label: string
  /** A CSS variable, e.g. `var(--chart-1)`. */
  color: string
  /** The period before: a thin dashed line behind the current one. */
  dashed?: boolean
}

export type TrendPoint = { label: string } & Record<string, number | string>

type GrowthTrendChartProps = {
  points: TrendPoint[]
  series: TrendSeries[]
  /** Formats an axis tick or a tooltip value (money, count). */
  formatValue: (n: number) => string
  /** Shown over the flat zero line when every point is 0. */
  emptyNote: string
  /** Height (and any width) of the plot. */
  className?: string
  /** Hides the y axis on small cards; the x axis stays. */
  compact?: boolean
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }

/** Every value of every series is 0 (or the chart has no points at all). */
export function isFlat(points: TrendPoint[], series: TrendSeries[]): boolean {
  return points.every((p) => series.every((s) => !Number(p[s.key])))
}

/**
 * The Growth line chart: axes, a soft grid, the current period as a filled line and the
 * period before dashed behind it. With no data yet it still draws the frame and a flat zero
 * line, with a muted note over it (Shopify's empty charts), so the chart never disappears.
 */
export default function GrowthTrendChart({
  points,
  series,
  formatValue,
  emptyNote,
  className,
  compact = false,
}: GrowthTrendChartProps) {
  // Render logic
  const flat = isFlat(points, series)
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ) satisfies ChartConfig
  const main = series.find((s) => !s.dashed)

  return (
    <div className={cn('relative w-full', className ?? 'h-56')}>
      <ChartContainer config={config} className="aspect-auto size-full">
        <ComposedChart
          data={points}
          margin={{ left: compact ? 4 : 0, right: 12, top: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border-soft)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickMargin={10}
            minTickGap={24}
            tick={AXIS_TICK}
          />
          <YAxis
            hide={compact}
            tickLine={false}
            axisLine={false}
            width={56}
            allowDecimals={false}
            tick={AXIS_TICK}
            domain={flat ? [0, 1] : [0, 'auto']}
            ticks={flat ? [0] : undefined}
            tickFormatter={(v: number) => formatValue(v)}
          />
          {flat ? null : (
            <ChartTooltip
              cursor={{ stroke: 'var(--border)' }}
              content={
                <ChartTooltipContent
                  formatter={(v, name) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {config[String(name)]?.label ?? String(name)}
                      </span>
                      <span className="font-semibold tabular-nums">{formatValue(Number(v))}</span>
                    </span>
                  )}
                />
              }
            />
          )}
          {series.map((s) =>
            s === main ? (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={s.color}
                fillOpacity={flat ? 0 : 0.08}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={1.25}
                strokeDasharray={s.dashed ? '3 3' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ChartContainer>
      {flat ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-4">
          <span className="rounded-md bg-card px-2 py-1 text-center text-caption text-muted-foreground">
            {emptyNote}
          </span>
        </p>
      ) : null}
    </div>
  )
}
