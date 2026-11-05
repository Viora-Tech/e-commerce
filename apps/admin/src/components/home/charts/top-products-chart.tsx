'use client'

import type { DashboardChartsData } from '@commerce/api'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import dynamic from 'next/dynamic'
import ChartLoading from '@/components/layout/chart-loading'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'

type TopProductsChartProps = {
  data: DashboardChartsData
  loading: boolean
}

const LABEL_MAX = 16

function shorten(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text
}

/* recharts is large: it loads only where a chart is drawn. */
const TopProductsPlot = dynamic(() => import('./top-products-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

/** Top 5 products by revenue for the picked range, as a horizontal bar chart. */
export default function TopProductsChart({ data, loading }: TopProductsChartProps) {
  // Hooks
  const copy = useCopy(homeContent)

  // Render logic
  const c = copy.charts
  const points = data.topProducts.map((p) => ({
    id: p.productId,
    label: shorten(p.title),
    fullTitle: p.title,
    revenuePaise: p.revenuePaise,
  }))

  return (
    <DataCard title={c.topProductsTitle}>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : points.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.topProductsEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="h-64 w-full">
            <TopProductsPlot points={points} />
          </div>
          <p className="text-caption text-muted-foreground">
            {c.topProductsLine(points[0]?.fullTitle ?? '')}
          </p>
        </div>
      )}
    </DataCard>
  )
}
