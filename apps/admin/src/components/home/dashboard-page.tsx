import type { DashboardChartsData, DashboardSummary } from '@commerce/api'
import PageBody from '@/components/layout/page-body'
import AskAiCard from './ask-ai-card'
import ChartsPanel from './charts/charts-panel'
import PaymentStatusDonuts from './charts/payment-status-donuts'
import SalesByStateChart from './charts/sales-by-state-chart'
import FinishSetup from './finish-setup'
import HomeGreeting from './home-greeting'
import type { HomeSignals } from './home-signals'
import InsightsList from './insights-list'
import LatestOrders from './latest-orders'
import LiveNow from './live-now'
import MoreNumbers from './more-numbers'
import SalesGoalRing from './sales-goal-ring'
import SalesHero from './sales-hero'
import Suggestions from './suggestions'
import TodoCards from './todo-cards'

type DashboardPageProps = {
  summary: DashboardSummary
  charts: DashboardChartsData
  firstName: string
  /** Show "Ask AI" (opens the AI bar): the assistant is on for this store and member. */
  assistant?: boolean
  /** What the store's apps say; null when the member cannot read apps (set-up cards hide). */
  signals: HomeSignals | null
  /** Carts left behind this week; null when the member cannot read orders. */
  abandoned: { carts: number; valuePaise: number } | null
}

/**
 * The home page, top to bottom: greeting and one plain sentence, the AI ask box, set-up
 * cards (only while something is open), the to-do cards, the sales hero, latest orders next
 * to Live now, and suggestions. Every other chart sits in the collapsed "More numbers".
 */
export default function DashboardPage({
  summary,
  charts,
  firstName,
  assistant = false,
  signals,
  abandoned,
}: DashboardPageProps) {
  return (
    <PageBody width="frame" className="max-w-[68rem] gap-10 md:mx-auto md:pt-9">
      <HomeGreeting
        firstName={firstName}
        ordersToday={summary.today.ordersCount}
        salesTodayPaise={summary.today.salesPaise}
        toShip={summary.today.toShipCount}
        now={new Date()}
      />
      <AskAiCard enabled={assistant} />
      {signals ? <FinishSetup productCount={summary.report.products} signals={signals} /> : null}
      <TodoCards needsYou={summary.needsYou} />
      <SalesHero today={summary.today} yesterdayHourly={summary.yesterday.hourly} charts={charts} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <LatestOrders orders={summary.recentOrders} />
        <LiveNow initial={summary} />
      </div>
      <Suggestions summary={summary} signals={signals} abandoned={abandoned} />
      <MoreNumbers>
        <InsightsList
          insight={summary.insight}
          needsYou={summary.needsYou}
          streakDays={summary.month.streakDays}
        />
        <ChartsPanel initialRange={30} initial={charts} />
        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
          <PaymentStatusDonuts paymentMix={summary.paymentMix} statusMix={summary.statusMix} />
          <SalesByStateChart salesByState={summary.salesByState} />
        </div>
        <SalesGoalRing month={summary.month} />
      </MoreNumbers>
    </PageBody>
  )
}
