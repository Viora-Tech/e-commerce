import { DASHBOARD_LOW_STOCK_THRESHOLD, type DashboardSummary } from '@commerce/api'
import { LowStockCard, RecentOrdersCard, TopProductsCard } from './dashboard-cards'
import { DashboardStats } from './dashboard-stats'
import { WeeklyReport } from './weekly-report'

/** Admin home laid out like the kit: stats, weekly report + low stock, orders + top products. */
export function DashboardPage({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 p-4 md:p-6">
      <DashboardStats
        sales={summary.sales}
        orders={summary.orders}
        pending={summary.pending}
        cancelled={summary.cancelled}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WeeklyReport {...summary.report} />
        <LowStockCard rows={summary.lowStock} threshold={DASHBOARD_LOW_STOCK_THRESHOLD} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2.7fr)_minmax(0,1fr)]">
        <RecentOrdersCard orders={summary.recentOrders} />
        <TopProductsCard products={summary.topProducts} />
      </div>
    </div>
  )
}
