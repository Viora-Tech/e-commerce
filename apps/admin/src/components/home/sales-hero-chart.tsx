'use client'

import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'

export type SalesChartPoint = { label: string; value: number | null; before: number | null }

type SalesHeroChartProps = {
  points: SalesChartPoint[]
  valueLabel: string
  beforeLabel: string
  emptyText: string
  /** Changes with the hero's range/metric: the lines crossfade with a 2px blur, never a jump. */
  swapKey: string
  /** Today shows raw counts; longer ranges show money (sales) or compact counts (orders). */
  formatTooltip: (value: number) => string
  formatTick: (value: number) => string
}

/* recharts is large: it loads only where a chart is drawn. */
const SalesHeroPlot = dynamic(() => import('./sales-hero-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/**
 * The hero's area chart: Today as a solid line with a soft fill, the comparison stretch
 * dashed behind it, token-coloured axes and a tooltip. Flat empty copy when no orders yet.
 */
export default function SalesHeroChart({
  points,
  valueLabel,
  beforeLabel,
  emptyText,
  swapKey,
  formatTooltip,
  formatTick,
}: SalesHeroChartProps) {
  // Early returns
  const hasData = points.some((p) => (p.value ?? 0) > 0 || (p.before ?? 0) > 0)
  if (!hasData) {
    return <p className="text-body text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="h-55 w-full">
      <SalesHeroPlot
        points={points}
        valueLabel={valueLabel}
        beforeLabel={beforeLabel}
        swapKey={swapKey}
        formatTooltip={formatTooltip}
        formatTick={formatTick}
      />
    </div>
  )
}
