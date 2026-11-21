import type { DashboardChartsData, DashboardSummary, HomeAnalytics, HomeFacts } from '@commerce/api'
import type { HomeCard } from '@commerce/core/home-cards'
import type { HomeMetric } from '@commerce/core/home-metrics'
import type { HomeTodo } from '@commerce/core/home-todos'
import type { StoreHealthReport } from '@commerce/core/store-health'
import PageBody from '@/components/layout/page-body'
import BackgroundWorkNotice from '@/components/media/background-work-notice'
import LocalStorageWarning from '@/components/media/local-storage-warning'
import GatewayKeysBanner from '@/components/payments/gateway-keys-banner'
import type { HomeRange, RangeCompare } from '@/lib/home-range'
import AskAiCard from './ask-ai-card'
import ChartsPanel from './charts/charts-panel'
import FinishSetup from './finish-setup'
import HomeEnter from './home-enter'
import HomeGreeting from './home-greeting'
import { HOME_NARROW, HOME_RHYTHM, HOME_SPLIT } from './home-layout'
import type { HomeSignals } from './home-signals'
import LatestOrders from './latest-orders'
import LiveNow from './live-now'
import NeedsYou from './needs-you'
import SalesGoalRow from './sales-goal-row'
import SalesHero from './sales-hero'
import Suggestions from './suggestions'

type DashboardPageProps = {
  summary: DashboardSummary
  charts: DashboardChartsData
  /** The analytics card's opening range (the last one picked, else Today), its numbers and tiles. */
  analytics: {
    range: HomeRange
    compare: RangeCompare
    analytics: HomeAnalytics
    tiles: HomeMetric[]
  }
  firstName: string
  /** Show "Ask AI" (opens the AI bar): the assistant is on for this store and member. */
  assistant?: boolean
  /** What the store's apps say; null when the member cannot read apps (set-up cards hide). */
  signals: HomeSignals | null
  /** Store health; null when the member cannot read settings (its row hides). */
  health: StoreHealthReport | null
  /** Smart cards built daily from the store's numbers; null when they could not be read. */
  cards: HomeCard[] | null
  /** To-dos the store hid ("Edit to-dos"); null when the setting could not be read. */
  hiddenTodos: HomeTodo[] | null
  /** Old to-ship orders, out-of-stock products and real payment methods; null on failure. */
  extras: HomeFacts | null
}

/**
 * The home page, top to bottom (Figma "Home · Redesign 19 Nov" 1044:11219, approved 19 Nov):
 * greeting and one plain sentence, the AI ask box, the sales card, set-up cards (only while a
 * step is open), Needs you (to-do tiles, Store health, old to-ship orders), latest orders next
 * to Live now, Ideas for your store, How you're doing (open) and the monthly goal row.
 */
export default function DashboardPage({
  summary,
  charts,
  analytics,
  firstName,
  assistant = false,
  signals,
  health,
  cards,
  hiddenTodos,
  extras,
}: DashboardPageProps) {
  return (
    <PageBody width="settings" className={HOME_RHYTHM}>
      {/* Owner 2026-10-17: Home keeps its 68rem column; the greeting and the Ask AI box sit in a
          narrower 48rem column centred above the rest. */}
      <div className={HOME_NARROW}>
        <HomeEnter index={0}>
          {/* "N need shipping" is Needs you's own count, so the page shows one number (19 Nov). */}
          <HomeGreeting
            firstName={firstName}
            ordersToday={summary.today.ordersCount}
            salesTodayPaise={summary.today.salesPaise}
            toShip={summary.needsYou.ordersToShip.count}
            now={new Date()}
          />
        </HomeEnter>
        <GatewayKeysBanner />
        <LocalStorageWarning />
        <BackgroundWorkNotice />
        <HomeEnter index={1}>
          <AskAiCard enabled={assistant} />
        </HomeEnter>
      </div>
      <HomeEnter index={2}>
        <SalesHero initial={analytics} liveNow={summary.liveVisitors.last30} />
      </HomeEnter>
      {signals ? (
        <HomeEnter index={3}>
          <FinishSetup productCount={summary.report.products} signals={signals} />
        </HomeEnter>
      ) : null}
      <HomeEnter index={3}>
        <NeedsYou
          needsYou={summary.needsYou}
          hidden={hiddenTodos}
          health={health}
          extras={extras}
        />
      </HomeEnter>
      <HomeEnter index={4}>
        <div className={HOME_SPLIT}>
          <LatestOrders orders={summary.recentOrders} />
          <LiveNow initial={summary} />
        </div>
      </HomeEnter>
      <HomeEnter index={5}>
        <Suggestions cards={cards} signals={signals} />
      </HomeEnter>
      <HomeEnter index={6}>
        <ChartsPanel
          initialRange={30}
          initial={charts}
          lowStock={summary.needsYou.lowStock.count}
          streakDays={summary.month.streakDays}
          paymentMix={extras?.paymentMix ?? null}
          statusMix={summary.statusMix}
          salesByState={summary.salesByState}
        />
      </HomeEnter>
      <HomeEnter index={7}>
        <SalesGoalRow month={summary.month} />
      </HomeEnter>
    </PageBody>
  )
}
