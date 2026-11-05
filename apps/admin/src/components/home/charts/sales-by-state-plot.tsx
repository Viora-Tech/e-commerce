'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import { useFormat } from '@/hooks/use-copy'

type SalesByStatePlotProps = {
  points: { code: string; label: string; revenuePaise: number }[]
}

const config = { revenuePaise: { label: 'Revenue', color: 'var(--chart-3)' } } satisfies ChartConfig

/** The bars of `SalesByStateChart`, which holds their height while recharts loads. */
export default function SalesByStatePlot({ points }: SalesByStatePlotProps) {
  // Hooks
  const fmt = useFormat()

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <BarChart data={points} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
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
          width={90}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(v) => (
                <span className="font-bold tabular-nums">{fmt.money(Number(v))}</span>
              )}
            />
          }
        />
        <Bar dataKey="revenuePaise" radius={4} maxBarSize={22} isAnimationActive={false}>
          {points.map((p) => (
            <Cell key={p.code} fill="var(--chart-3)" />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
