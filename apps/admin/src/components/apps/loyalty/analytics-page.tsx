'use client'

import { useState } from 'react'
import AnalyticsRevenueCard from '@/components/apps/loyalty/analytics-revenue-card'
import AnalyticsRoiCard from '@/components/apps/loyalty/analytics-roi-card'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DateRangePicker from '@/components/layout/date-range-picker'
import { percentDelta } from '@/components/layout/delta-chip'
import PageHeader from '@/components/layout/page-header'
import SectionHead from '@/components/layout/section-head'
import StatStrip from '@/components/layout/stat-strip'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { formatRate } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { addDays, type HomeRange, rangeFor, spanDays } from '@/lib/home-range'
import { aovPaise, fillDays, rangeInstants } from '@/lib/loyalty-insights'

/** The pickable ranges: no "Today", a one-point chart says nothing. */
const PRESETS = [
  '7d',
  '30d',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'thisFy',
  'diwali',
  'festive',
  'custom',
] as const

/** The same number of days just before the range: what every figure is compared with. */
function previousOf(range: { from: string; to: string }): { from: string; to: string } {
  const span = spanDays(range.from, range.to)
  return { from: addDays(range.from, -span), to: addDays(range.from, -1) }
}

/** A change in percent, or null when there is nothing to compare with. */
function trendOf(value: number | null, before: number | null): number | null {
  if (value === null || before === null) return null
  return percentDelta(value, before)
}

/** A tile's trend fields; none while there is no change to show, so its own note line stays. */
function withTrend(change: number | null, note: string): { trend?: number; trendNote?: string } {
  return change === null ? {} : { trend: change, trendNote: note }
}

/** One figure's change against the period before, or null with either side missing. */
function changeOf<T>(cur: T | null, prev: T | null, pick: (x: T) => number): number | null {
  return cur && prev ? trendOf(pick(cur), pick(prev)) : null
}

/**
 * Loyalty analytics in Essential Loyalty's layout, on our numbers: the range against the period
 * before; Revenue (loyalty revenue chart beside the ROI card, then loyalty orders, orders with
 * rewards and loyalty AOV) and Engagement (active members, new members, redemption rate).
 */
export default function LoyaltyAnalyticsPage() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const [range, setRange] = useState<HomeRange>(() => rangeFor('30d'))
  const { data, failed, loading, retry } = useLoad(async () => {
    const at = rangeInstants(range)
    const before = rangeInstants(previousOf(range))
    const [figures, revenue, prevFigures, prevRevenue] = await Promise.all([
      api.loyalty.analytics(at),
      api.loyalty.insights.getRevenue(at),
      api.loyalty.analytics(before),
      api.loyalty.insights.getRevenue(before),
    ])
    return { figures, revenue, prevFigures, prevRevenue }
  }, [range.from, range.to])

  // Helpers
  const money = (v: number | null) => (v === null ? copy.analytics.none : f.moneyWhole(v))
  const a = copy.analytics
  const t = a.tiles
  const header = (
    <PageHeader
      title={a.title}
      summary={a.summary}
      actions={<DateRangePicker range={range} presets={PRESETS} onApply={(r) => setRange(r)} />}
    />
  )

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <LoadFailedState size="page" heading={a.loadFailed} failed={failed} onRetry={retry} />
      </div>
    )
  }

  // Render logic
  const busy = loading || !data
  const fig = busy ? null : (data?.figures ?? null)
  const prev = data?.prevFigures ?? null
  const before = data
    ? fillDays(previousOf(range), data.prevRevenue.days, (d) => d.memberRevenuePaise)
    : []
  const days = data
    ? fillDays(range, data.revenue.days, (d) => d.memberRevenuePaise).map((d, i) => ({
        ...d,
        before: before[i]?.value ?? 0,
      }))
    : []
  const memberAov = fig ? aovPaise(fig.memberRevenuePaise, fig.memberOrders) : null
  const prevAov = prev ? aovPaise(prev.memberRevenuePaise, prev.memberOrders) : null
  const otherAov = data ? aovPaise(data.revenue.otherRevenuePaise, data.revenue.otherOrders) : null

  return (
    <div className="flex flex-col gap-5">
      {header}
      <section className="flex flex-col gap-3">
        <SectionHead title={a.revenueSection} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <AnalyticsRevenueCard
            days={days}
            totalPaise={fig?.memberRevenuePaise ?? 0}
            delta={
              fig && prev ? percentDelta(fig.memberRevenuePaise, prev.memberRevenuePaise) : null
            }
            loading={busy}
          />
          <AnalyticsRoiCard figures={fig} />
        </div>
        <StatStrip
          columns={3}
          loading={busy}
          placeholders={3}
          tiles={
            fig
              ? [
                  {
                    id: 'orders',
                    label: t.orders,
                    value: f.number(fig.memberOrders),
                    note: t.ordersNote,
                    ...withTrend(
                      changeOf(fig, prev, (x) => x.memberOrders),
                      a.trendNote,
                    ),
                  },
                  {
                    id: 'withRewards',
                    label: t.withRewards,
                    value: f.number(fig.ordersWithRewards),
                    note: t.withRewardsNote,
                    ...withTrend(
                      changeOf(fig, prev, (x) => x.ordersWithRewards),
                      a.trendNote,
                    ),
                  },
                  {
                    id: 'aov',
                    label: t.aov,
                    value: money(memberAov),
                    note: t.aovNote(money(otherAov)),
                    ...withTrend(trendOf(memberAov, prevAov), a.trendNote),
                  },
                ]
              : []
          }
        />
      </section>
      <section className="flex flex-col gap-3">
        <SectionHead title={a.engagementSection} />
        <StatStrip
          columns={3}
          loading={busy}
          placeholders={3}
          tiles={
            fig
              ? [
                  {
                    id: 'activeMembers',
                    label: t.activeMembers,
                    value: f.number(fig.activeMembers),
                    note: t.activeMembersNote,
                    ...withTrend(
                      changeOf(fig, prev, (x) => x.activeMembers),
                      a.trendNote,
                    ),
                  },
                  {
                    id: 'newMembers',
                    label: t.newMembers,
                    value: f.number(fig.newMembers),
                    note: t.newMembersNote,
                    ...withTrend(
                      changeOf(fig, prev, (x) => x.newMembers),
                      a.trendNote,
                    ),
                  },
                  {
                    id: 'redemptionRate',
                    label: t.redemptionRate,
                    value: formatRate(fig.redemptionRate),
                    note: t.redemptionRateNote(f.number(fig.redemptions)),
                    ...withTrend(
                      changeOf(fig, prev, (x) => x.redemptionRate),
                      a.trendNote,
                    ),
                  },
                ]
              : []
          }
        />
      </section>
    </div>
  )
}
