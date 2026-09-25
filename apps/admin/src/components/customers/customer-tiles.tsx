import { formatNumber } from '@commerce/money'
import { percentDelta } from '@/components/layout/delta-chip'
import StatCard from '@/components/layout/stat-card'
import { customersContent } from '@/data/customers'
import type { api } from '@/lib/api-client'

export type CustomerStats = Awaited<ReturnType<typeof api.customers.stats>>
export type CustomerOverview = Awaited<ReturnType<typeof api.customers.overview>>

type CustomerTilesProps = {
  stats: CustomerStats
  visitors: CustomerOverview['visitors']
}

/**
 * Frames 5:3026 / 5:3038 / 5:3050: three 270 x 135 tiles stacked 20px apart down
 * the left of the overview chart, each carrying its figure, weekly change and period.
 */
export default function CustomerTiles({ stats, visitors }: CustomerTilesProps) {
  // Render logic
  const t = customersContent.tiles

  return (
    <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-1">
      <StatCard
        size="sm"
        title={t.total}
        value={formatNumber(stats.total)}
        delta={percentDelta(stats.total, stats.totalPrevious)}
        period={t.week}
      />
      <StatCard
        size="sm"
        title={t.newCustomers}
        value={formatNumber(stats.newLast7)}
        delta={percentDelta(stats.newLast7, stats.newPrevious7)}
        period={t.week}
      />
      <StatCard
        size="sm"
        title={t.visitors}
        value={formatNumber(visitors.value)}
        delta={percentDelta(visitors.value, visitors.previous)}
        period={t.week}
      />
    </div>
  )
}
