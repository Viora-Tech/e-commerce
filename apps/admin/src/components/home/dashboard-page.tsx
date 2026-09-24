import type { DashboardSummary } from '@commerce/api'
import PageBody from '@/components/layout/page-body'
import IndiaOrderMap from './india-order-map'
import InsightsList from './insights-list'
import LiveOrderStream from './live-order-stream'
import NeedsYouList from './needs-you-list'
import SalesGoalRing from './sales-goal-ring'
import TodayBriefing from './today-briefing'

type DashboardPageProps = {
  summary: DashboardSummary
  firstName: string
}

/**
 * The home page: a plain-language briefing, the "Needs you" inbox and a few
 * insights first (what the owner actually opens this page to see), then a
 * mini order map with a live stream and the monthly goal ring. No KPI grid.
 */
export default function DashboardPage({ summary, firstName }: DashboardPageProps) {
  return (
    <PageBody width="frame" className="gap-6">
      <TodayBriefing
        firstName={firstName}
        ordersToday={summary.today.ordersCount}
        salesTodayPaise={summary.today.salesPaise}
        toShip={summary.today.toShipCount}
        now={new Date()}
      />
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
          <IndiaOrderMap orders={summary.mapOrders} />
          <LiveOrderStream orders={summary.recentOrders} />
        </div>
        <SalesGoalRing month={summary.month} />
      </div>
    </PageBody>
  )
}
