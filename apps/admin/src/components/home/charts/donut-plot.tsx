'use client'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Cell, Pie, PieChart } from 'recharts'

export type DonutSlice = { key: string; label: string; count: number }

type DonutPlotProps = {
  slices: DonutSlice[]
  /** The slices' colours, in turn; the legend beside the donut uses the same ones. */
  colors: readonly string[]
  total: number
}

const config = {} satisfies ChartConfig

/** One donut; the card beside it holds its size while recharts loads. */
export default function DonutPlot({ slices, colors, total }: DonutPlotProps) {
  return (
    <ChartContainer config={config} className="aspect-square size-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(v, _name, item) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {(item.payload as DonutSlice).label}
                  </span>
                  <span className="font-bold tabular-nums">
                    {Math.round((Number(v) / total) * 100)}%
                  </span>
                </span>
              )}
            />
          }
        />
        <Pie
          data={slices}
          dataKey="count"
          nameKey="label"
          innerRadius={32}
          outerRadius={56}
          strokeWidth={2}
        >
          {slices.map((s, i) => (
            <Cell key={s.key} fill={colors[i % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
