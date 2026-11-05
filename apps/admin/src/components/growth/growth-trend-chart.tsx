'use client'

import { cn } from '@commerce/ui/lib/utils'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'

/** One line on the chart. The first non-dashed series is drawn as a filled area. */
export type TrendSeries = {
  key: string
  label: string
  /** A CSS variable, e.g. `var(--chart-1)`. */
  color: string
  /** The period before: a thin dashed line behind the current one. */
  dashed?: boolean
}

export type TrendPoint = { label: string } & Record<string, number | string>

type GrowthTrendChartProps = {
  points: TrendPoint[]
  series: TrendSeries[]
  /** Formats an axis tick or a tooltip value (money, count). */
  formatValue: (n: number) => string
  /** Shown over the flat zero line when every point is 0. */
  emptyNote: string
  /** Height (and any width) of the plot. */
  className?: string
  /** Hides the y axis on small cards; the x axis stays. */
  compact?: boolean
}

/* recharts is large: it loads only where a chart is drawn. */
const GrowthTrendPlot = dynamic(() => import('./growth-trend-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/** A Growth line chart at its height; `GrowthTrendPlot` draws it once recharts has loaded. */
export default function GrowthTrendChart({ className, ...plot }: GrowthTrendChartProps) {
  return (
    <div className={cn('w-full', className ?? 'h-56')}>
      <GrowthTrendPlot {...plot} />
    </div>
  )
}
