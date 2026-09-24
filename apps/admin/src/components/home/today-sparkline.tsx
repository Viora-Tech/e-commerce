'use client'

import { type ChartConfig, ChartContainer } from '@commerce/ui/shadcn/chart'
import { Line, LineChart } from 'recharts'

type TodaySparklineProps = {
  today: number[]
  yesterday: number[]
  className?: string
}

const config = {
  today: { label: 'Today', color: 'var(--chart-1)' },
  yesterday: { label: 'Yesterday', color: 'var(--chart-5)' },
} satisfies ChartConfig

/** Today (solid) against yesterday (dashed), hour by hour: no axes, just the shape of the day. */
export default function TodaySparkline({ today, yesterday, className }: TodaySparklineProps) {
  // Render logic
  const points = today.map((value, hour) => ({
    hour,
    today: value,
    yesterday: yesterday[hour] ?? 0,
  }))

  return (
    <ChartContainer config={config} className={className ?? 'aspect-auto h-10 w-24'}>
      <LineChart data={points} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
        <Line
          dataKey="yesterday"
          type="monotone"
          stroke="var(--chart-5)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="today"
          type="monotone"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
