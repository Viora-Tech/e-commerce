import { DASHBOARD_LOW_STOCK_THRESHOLD, type DashboardSummary } from '@commerce/api'
import { PageBody } from '@/components/layout/page-body'
import { ActivityCard } from './activity-card'
import { BestSellingCard } from './best-selling-card'
import { DashboardStats } from './dashboard-stats'
import { LowStockCard } from './low-stock-card'
import { RecentOrdersCard } from './recent-orders-card'
import { TopProductsCard } from './top-products-card'
import { WeeklyReport } from './weekly-report'

/**
 * Frame 5:1346 rows, top to bottom: three 222px stat cards 16px apart; the
 * 739 / 361 report + activity pair; the 808 / 292 transactions + top products
 * pair; the 739 / 361 best-selling + quick-list pair. All gaps are 20px.
 */
export function DashboardPage({ summary }: { summary: DashboardSummary }) {
  return (
    <PageBody className="gap-5">
      <DashboardStats
        sales={summary.sales}
        orders={summary.orders}
        pending={summary.pending}
        cancelled={summary.cancelled}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <WeeklyReport {...summary.report} />
        <ActivityCard
          ordersLast24h={summary.activity.ordersLast24h}
          perHour={summary.activity.perHour}
          salesByState={summary.salesByState}
        />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,808fr)_minmax(0,292fr)]">
        <RecentOrdersCard orders={summary.recentOrders} />
        <TopProductsCard products={summary.topProducts} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <BestSellingCard products={summary.topProducts} />
        <LowStockCard rows={summary.lowStock} threshold={DASHBOARD_LOW_STOCK_THRESHOLD} />
      </div>
    </PageBody>
  )
}
