'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { homeContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'

type SalesOrdersPlotProps = {
  points: { label: string; sales: number; previousSales: number | null; orders: number }[]
  metric: 'sales' | 'orders'
  /** The period before exists: drawn dashed behind the sales. */
  hasPrevious: boolean
}

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }

/** The picture of `SalesOrdersChart`, which holds its height while recharts loads. */
export default function SalesOrdersPlot({ points, metric, hasPrevious }: SalesOrdersPlotProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()

  // Render logic
  const c = copy.charts
  const config = {
    sales: { label: c.salesToggle, color: 'var(--chart-1)' },
    orders: { label: c.ordersToggle, color: 'var(--chart-2)' },
    previousSales: { label: c.previous, color: 'var(--chart-5)' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <ComposedChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="home-sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border-soft)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          tick={AXIS_TICK}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => (metric === 'sales' ? fmt.moneyCompact(v) : String(v))}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--chart-1)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltipContent
              formatter={(v, name) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {name === 'previousSales'
                      ? c.previous
                      : name === 'orders'
                        ? c.ordersToggle
                        : c.salesToggle}
                  </span>
                  <span className="font-bold tabular-nums">
                    {name === 'orders' ? String(v) : fmt.money(Number(v))}
                  </span>
                </span>
              )}
            />
          }
        />
        {metric === 'sales' ? (
          <>
            {hasPrevious ? (
              <Line
                dataKey="previousSales"
                type="monotone"
                stroke="var(--chart-5)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Area
              dataKey="sales"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#home-sales-fill)"
              isAnimationActive={false}
              connectNulls
            />
          </>
        ) : (
          <Bar
            dataKey="orders"
            fill="var(--chart-2)"
            radius={4}
            maxBarSize={32}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  )
}
