import { DASHBOARD_LOW_STOCK_THRESHOLD, type DashboardSummary } from '@commerce/api'
import PageBody from '@/components/layout/page-body'
import ActivityCard from './activity-card'
import BestSellingCard from './best-selling-card'
import DashboardStats from './dashboard-stats'
import LowStockCard from './low-stock-card'
import QuickAddCard from './quick-add-card'
import RecentOrdersCard from './recent-orders-card'
import TopProductsCard from './top-products-card'
import WeeklyReport from './weekly-report'

/**
 * Frame 5:1346 rows, top to bottom: three 222px stat cards 16px apart; the
 * report + activity pair; transactions + top products; best-selling + the
 * "Add new product" quick list. Every row shares the 739 / 361 split so the
 * right rail aligns (the frame mixes 808 / 292 on one row). Low stock is ours,
 * in a fifth row. All gaps are 20px.
 */
export default function DashboardPage({ summary }: { summary: DashboardSummary }) {
  return (
    <PageBody width="frame" className="gap-5">
      <DashboardStats
        sales={summary.sales}
        orders={summary.orders}
        pending={summary.pending}
        cancelled={summary.cancelled}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <WeeklyReport {...summary.report} />
        <ActivityCard liveVisitors={summary.liveVisitors} salesByState={summary.salesByState} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <RecentOrdersCard orders={summary.recentOrders} />
        <TopProductsCard products={summary.topProducts} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <BestSellingCard products={summary.topProducts} />
        <QuickAddCard categories={summary.categories} products={summary.latestProducts} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <LowStockCard rows={summary.lowStock} threshold={DASHBOARD_LOW_STOCK_THRESHOLD} />
      </div>
    </PageBody>
  )
}
