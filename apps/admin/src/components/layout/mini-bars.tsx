'use client'

import { cn } from '@commerce/ui/lib/utils'
import { ChartContainer } from '@commerce/ui/shadcn/chart'
import { Bar, BarChart } from 'recharts'
import { type ChartPoint, chartConfig } from './chart-config'

type MiniBarsProps = { data: ChartPoint[]; className?: string }

/** 5:1620 "bargraph": 35px strip of 8px green bars, 3px apart, no axes. */
export function MiniBars({ data, className }: MiniBarsProps) {
  return (
    <ChartContainer config={chartConfig} className={cn('aspect-auto h-8 w-full', className)}>
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
