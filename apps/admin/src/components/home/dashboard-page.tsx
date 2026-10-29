import type { DashboardChartsData, DashboardSummary, HomeAnalytics } from '@commerce/api'
import type { HomeMetric } from '@commerce/core/home-metrics'
import type { StoreHealthReport } from '@commerce/core/store-health'
import PageBody from '@/components/layout/page-body'
import BackgroundWorkNotice from '@/components/media/background-work-notice'
import LocalStorageWarning from '@/components/media/local-storage-warning'
import type { HomeRange } from '@/lib/home-range'
import AskAiCard from './ask-ai-card'
import ChartsPanel from './charts/charts-panel'
import PaymentStatusDonuts from './charts/payment-status-donuts'
import SalesByStateChart from './charts/sales-by-state-chart'
import FinishSetup from './finish-setup'
import HomeEnter from './home-enter'
import HomeGreeting from './home-greeting'
import type { HomeSignals } from './home-signals'
import InsightsList from './insights-list'
import LatestOrders from './latest-orders'
import LiveNow from './live-now'
import MoreNumbers from './more-numbers'
import SalesGoalRing from './sales-goal-ring'
import SalesHero from './sales-hero'
import StoreHealthCard from './store-health-card'
import Suggestions from './suggestions'
import TodoCards from './todo-cards'

type DashboardPageProps = {
  summary: DashboardSummary
  charts: DashboardChartsData
  /** The analytics card's opening range (Today), its numbers and this member's tiles. */
  analytics: { range: HomeRange; analytics: HomeAnalytics; tiles: HomeMetric[] }
  firstName: string
  /** Show "Ask AI" (opens the AI bar): the assistant is on for this store and member. */
  assistant?: boolean
  /** What the store's apps say; null when the member cannot read apps (set-up cards hide). */
  signals: HomeSignals | null
  /** Carts left behind this week; null when the member cannot read orders. */
  abandoned: { carts: number; valuePaise: number } | null
  /** Store health; null when the member cannot read settings (the card hides). */
  health: StoreHealthReport | null
}

/**
 * The home page, top to bottom: greeting and one plain sentence, the AI ask box, set-up
 * cards (only while something is open), the to-do cards, the sales hero, latest orders next
 * to Live now, and suggestions. Every other chart sits in the collapsed "More numbers".
 */
export default function DashboardPage({
  summary,
  charts,
  analytics,
  firstName,
  assistant = false,
  signals,
  abandoned,
  health,
}: DashboardPageProps) {
  return (
    <PageBody width="frame" className="mx-auto max-w-[68rem] gap-10 md:pt-5">
      {/* Owner 2026-10-17: Home keeps its 68rem column; the greeting and the Ask AI box sit in a
          narrower 48rem column centred above the rest. */}
      <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-10">
        <HomeEnter index={0}>
          <HomeGreeting
            firstName={firstName}
            ordersToday={summary.today.ordersCount}
            salesTodayPaise={summary.today.salesPaise}
            toShip={summary.today.toShipCount}
            liveNow={summary.liveVisitors.last30}
            now={new Date()}
          />
        </HomeEnter>
        <LocalStorageWarning />
        <BackgroundWorkNotice />
        <HomeEnter index={1}>
          <AskAiCard enabled={assistant} />
        </HomeEnter>
      </div>
      {/* Owner 2026-10-17: the sales analytics come second, right under the greeting and Ask AI. */}
      <HomeEnter index={2}>
        <SalesHero initial={analytics} liveNow={summary.liveVisitors.last30} />
      </HomeEnter>
      {signals ? (
        <HomeEnter index={3}>
          <FinishSetup productCount={summary.report.products} signals={signals} />
        </HomeEnter>
      ) : null}
      {health ? (
        <HomeEnter index={3}>
          <StoreHealthCard report={health} />
        </HomeEnter>
      ) : null}
      <HomeEnter index={4}>
        <TodoCards needsYou={summary.needsYou} />
      </HomeEnter>
      <HomeEnter index={5}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,640fr)_minmax(0,424fr)]">
          <LatestOrders orders={summary.recentOrders} />
          <LiveNow initial={summary} />
        </div>
      </HomeEnter>
      <HomeEnter index={6}>
        <Suggestions summary={summary} signals={signals} abandoned={abandoned} />
      </HomeEnter>
      <HomeEnter index={7}>
        <MoreNumbers
          salesPreview={charts.salesPaise.slice(-30)}
          ordersPreview={charts.orders.slice(-30)}
        >
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
      </HomeEnter>
    </PageBody>
  )
}
