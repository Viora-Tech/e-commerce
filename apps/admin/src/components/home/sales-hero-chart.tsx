'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'

export type SalesChartPoint = { label: string; value: number | null; before: number | null }

type SalesHeroChartProps = {
  points: SalesChartPoint[]
  valueLabel: string
  beforeLabel: string
  emptyText: string
  /** Today shows raw counts; longer ranges show money (sales) or compact counts (orders). */
  formatTooltip: (value: number) => string
  formatTick: (value: number) => string
}

/**
 * The hero's area chart: Today as a solid line with a soft fill, the comparison stretch
 * dashed behind it, token-coloured axes and a tooltip. Flat empty copy when no orders yet.
 */
export default function SalesHeroChart({
  points,
  valueLabel,
  beforeLabel,
  emptyText,
  formatTooltip,
  formatTick,
}: SalesHeroChartProps) {
  // Render logic
  const config = {
    value: { label: valueLabel, color: 'var(--primary)' },
    before: { label: beforeLabel, color: 'var(--muted-foreground)' },
  } satisfies ChartConfig
  const hasData = points.some((p) => (p.value ?? 0) > 0 || (p.before ?? 0) > 0)

  // Early returns
  if (!hasData) {
    return <p className="text-body text-muted-foreground">{emptyText}</p>
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full">
      <AreaChart data={points} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="home-hero-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          minTickGap={48}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickFormatter={formatTick}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--primary)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltipContent
              formatter={(v, name) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label}
                  </span>
                  <span className="font-bold tabular-nums">{formatTooltip(Number(v))}</span>
                </span>
              )}
            />
          }
        />
        <Line
          dataKey="before"
          type="monotone"
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#home-hero-fill)"
          isAnimationActive={false}
          connectNulls={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
