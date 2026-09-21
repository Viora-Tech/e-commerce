import type { ChartConfig } from '@commerce/ui/shadcn/chart'

export type ChartPoint = { label: string; value: number }

export const chartConfig = {
  value: { label: 'Value', color: 'var(--chart-1)' },
} satisfies ChartConfig
