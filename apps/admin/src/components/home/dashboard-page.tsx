import type { DashboardChartsData, DashboardSummary } from '@commerce/api'
import PageBody from '@/components/layout/page-body'
import AskStoreCard from './ask-store-card'
import ChartsPanel from './charts/charts-panel'
import HoursHeatmap from './charts/hours-heatmap'
import PaymentStatusDonuts from './charts/payment-status-donuts'
import SalesByStateChart from './charts/sales-by-state-chart'
import InsightsList from './insights-list'
import LiveGlobeCard from './live-globe/live-globe-card'
import LiveOrderStream from './live-order-stream'
import NeedsYouList from './needs-you-list'
import SalesGoalRing from './sales-goal-ring'
import TodayBriefing from './today-briefing'

type DashboardPageProps = {
  summary: DashboardSummary
  charts: DashboardChartsData
  firstName: string
  /** Show "Ask your store": AI is on for this store and member. */
  askStore?: boolean
}

/**
 * The home page: a plain-language briefing, the "Needs you" inbox and a few
 * insights first (what the owner actually opens this page to see), then a
 * Live view globe with a live stream and the monthly goal ring. No KPI grid.
 */
export default function DashboardPage({
  summary,
  charts,
  firstName,
  askStore = false,
}: DashboardPageProps) {
  return (
    <PageBody width="frame" className="gap-6">
      <TodayBriefing
        firstName={firstName}
        ordersToday={summary.today.ordersCount}
        salesTodayPaise={summary.today.salesPaise}
        toShip={summary.today.toShipCount}
        now={new Date()}
        todayHourly={summary.today.hourly}
        yesterdayHourly={summary.yesterday.hourly}
      />
      {askStore ? <AskStoreCard /> : null}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <NeedsYouList needsYou={summary.needsYou} />
        <InsightsList
          insight={summary.insight}
          needsYou={summary.needsYou}
          streakDays={summary.month.streakDays}
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <div className="flex flex-col gap-5">
          <LiveGlobeCard initial={summary} />
          <LiveOrderStream orders={summary.recentOrders} />
        </div>
        <SalesGoalRing month={summary.month} />
      </div>
      <ChartsPanel initialRange={30} initial={charts} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <PaymentStatusDonuts paymentMix={summary.paymentMix} statusMix={summary.statusMix} />
        <SalesByStateChart salesByState={summary.salesByState} />
      </div>
      <HoursHeatmap hoursHeatmap={summary.hoursHeatmap} />
    </PageBody>
  )
}
