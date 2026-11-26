'use client'

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '../../shadcn/chart'

type AreaSeries = {
  key: string
  label: string
  /** A CSS colour, `var(--chart-1)` by default for the first series and `--chart-2` after. */
  color?: string | undefined
}

type StackedAreaChartProps = {
  /** One row per period: `label` on the x axis and a number per series key. */
  data: ({ label: string } & Record<string, number | string>)[]
  series: AreaSeries[]
  /** Chart height in rem; the width fills the card. */
  heightRem?: number | undefined
  /** A row's tooltip heading; the label by default. */
  tooltipLabel?: ((label: string) => string) | undefined
  /** Stack the series (parts of one whole); off draws each from zero. */
  stacked?: boolean | undefined
  /** A legend under the chart naming each series by its colour. */
  legend?: boolean | undefined
}

/**
 * shadcn's "Area Chart - Interactive" (dashboard-01's ChartAreaInteractive, MIT) as a shared
 * component: stacked areas with a soft fill, a horizontal grid, the x axis and a tooltip. Apps
 * that do not depend on recharts themselves (the storefront's affiliate portal) draw it here.
 */
export default function StackedAreaChart({
  data,
  series,
  heightRem = 15.625,
  tooltipLabel,
  stacked = false,
  legend = false,
}: StackedAreaChartProps) {
  // Render logic
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: s.color ?? `var(--chart-${i + 1})` }]),
  )
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: `${heightRem}rem` }}
    >
      <AreaChart data={data}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.8} />
              <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(value) =>
                tooltipLabel ? tooltipLabel(String(value)) : String(value)
              }
            />
          }
        />
        {legend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {[...series].reverse().map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="natural"
            fill={`url(#fill-${s.key})`}
            stroke={`var(--color-${s.key})`}
            {...(stacked ? { stackId: 'a' } : {})}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}
