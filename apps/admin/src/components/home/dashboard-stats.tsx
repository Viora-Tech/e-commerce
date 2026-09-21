import { DeltaChip, percentDelta, StatCard } from '@/components/layout/stat-card'
import { homeContent } from '@/data/home'
import { formatCompact, formatPaise, formatPaiseCompact } from '@/lib/money'

type Window = { value: number; previous: number }

type DashboardStatsProps = {
  sales: Window
  orders: Window
  pending: Window
  cancelled: Window
}

/** The three kit stat cards across the top of the dashboard. */
export function DashboardStats({ sales, orders, pending, cancelled }: DashboardStatsProps) {
  const c = homeContent
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StatCard
        title={c.stats.sales.title}
        period={c.period}
        value={formatPaiseCompact(sales.value)}
        unit={c.stats.sales.unit}
        delta={percentDelta(sales.value, sales.previous)}
        previous={{ label: c.previous, value: formatPaise(sales.previous) }}
        detailsHref="/orders"
      />
      <StatCard
        title={c.stats.orders.title}
        period={c.period}
        value={formatCompact(orders.value)}
        unit={c.stats.orders.unit}
        delta={percentDelta(orders.value, orders.previous)}
        previous={{ label: c.previous, value: formatCompact(orders.previous) }}
        detailsHref="/orders"
      />
      <StatCard
        title={c.stats.pendingCancelled.title}
        period={c.period}
        value=""
        detailsHref="/orders?status=placed"
      >
        <div className="mt-4 grid grid-cols-[1fr_1px_1fr] items-start gap-x-5">
          <div>
            <p className="text-period text-foreground">{c.stats.pendingCancelled.pending}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-stat-sm leading-5 tabular-nums text-ink-strong">
                {formatCompact(pending.value)}
              </span>
              <DeltaChip delta={percentDelta(pending.value, pending.previous)} invert />
            </div>
          </div>
          <span className="mt-2 h-8 w-px bg-border" aria-hidden="true" />
          <div>
            <p className="text-period text-foreground">{c.stats.pendingCancelled.cancelled}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-stat-sm leading-5 tabular-nums text-destructive">
                {formatCompact(cancelled.value)}
              </span>
              <DeltaChip delta={percentDelta(cancelled.value, cancelled.previous)} invert />
            </div>
          </div>
        </div>
      </StatCard>
    </div>
  )
}
