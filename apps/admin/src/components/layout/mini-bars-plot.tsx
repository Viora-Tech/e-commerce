'use client'

import { ChartContainer } from '@commerce/ui/shadcn/chart'
import { Bar, BarChart } from 'recharts'
import { type ChartPoint, chartConfig } from './chart-config'

type MiniBarsPlotProps = { data: ChartPoint[] }

/** The bars themselves; `MiniBars` holds their height while recharts loads. */
export default function MiniBarsPlot({ data }: MiniBarsPlotProps) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto size-full">
      <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barCategoryGap={3}>
        <Bar
          dataKey="value"
          fill="var(--chart-1)"
          radius={2}
          minPointSize={4}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  )
}
