'use client'

import type { DashboardChartsData } from '@commerce/api'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { homeContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import LabelledBars from './labelled-bars'

type TopProductsChartProps = {
  data: DashboardChartsData
  loading: boolean
}

/**
 * "Top products · by sales": the range's five best earners as labelled bars, each name in full
 * (it wraps rather than being cut to 16 characters), the figure on the right.
 */
export default function TopProductsChart({ data, loading }: TopProductsChartProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()

  // Render logic
  const c = copy.charts
  const top = data.topProducts[0]?.revenuePaise ?? 0
  const bars = data.topProducts.map((p) => ({
    key: p.productId,
    label: p.title,
    value: fmt.moneyWhole(p.revenuePaise),
    share: top > 0 ? p.revenuePaise / top : 0,
  }))

  return (
    <DataCard title={c.topProductsTitle}>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : bars.length === 0 ? (
        <EmptyState variant="inline" body={c.topProductsEmpty} />
      ) : (
        <LabelledBars bars={bars} label={c.topProductsTitle} />
      )}
    </DataCard>
  )
}
