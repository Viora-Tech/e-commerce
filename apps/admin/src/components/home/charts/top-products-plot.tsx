'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import { useFormat } from '@/hooks/use-copy'

type TopProductsPlotProps = {
  points: { id: string; label: string; fullTitle: string; revenuePaise: number }[]
}

const BAR_HEIGHT = 36

const config = { revenuePaise: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig

/** The bars of `TopProductsChart`, which holds their height while recharts loads. */
export default function TopProductsPlot({ points }: TopProductsPlotProps) {
  // Hooks
  const fmt = useFormat()

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <BarChart
        data={points}
        layout="vertical"
        margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
        barCategoryGap={10}
      >
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v: number) => fmt.moneyCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={100}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(v, _name, item) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {(item.payload as { fullTitle: string }).fullTitle}
                  </span>
                  <span className="font-bold tabular-nums">{fmt.money(Number(v))}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="revenuePaise" radius={4} maxBarSize={BAR_HEIGHT} isAnimationActive={false}>
          {points.map((p) => (
            <Cell key={p.id} fill="var(--chart-1)" />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
