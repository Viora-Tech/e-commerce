'use client'

import { useState } from 'react'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import ChartCard from '@/components/layout/chart-card'
import DateRangePicker from '@/components/layout/date-range-picker'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { formatRate } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { type HomeRange, rangeFor } from '@/lib/home-range'
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

/** What the loyalty program brings in over a range: member revenue by day and the program's figures. */
export default function LoyaltyAnalyticsPage() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const [range, setRange] = useState<HomeRange>(() => rangeFor('30d'))
  const { data, failed, loading, retry } = useLoad(async () => {
    const at = rangeInstants(range)
    const [figures, revenue] = await Promise.all([
      api.loyalty.analytics(at),
      api.loyalty.insights.getRevenue(at),
    ])
    return { figures, revenue }
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
  const days = data
    ? fillDays(range, data.revenue.days, (d) => d.memberRevenuePaise).map((d) => ({
        label: f.pattern(new Date(`${d.day}T00:00:00+05:30`), { day: 'numeric', month: 'short' }),
        value: d.value,
      }))
    : []
  const fig = data?.figures
  const memberAov = fig ? aovPaise(fig.memberRevenuePaise, fig.memberOrders) : null
  const otherAov = data ? aovPaise(data.revenue.otherRevenuePaise, data.revenue.otherOrders) : null

  return (
    <div className="flex flex-col gap-5">
      {header}
      <ChartCard
        title={a.revenueTitle}
        subtitle={fig ? a.revenueSubtitle(f.moneyWhole(fig.memberRevenuePaise)) : undefined}
        periods={[{ id: 'day', label: a.revenueTitle, data: days }]}
        seriesKey={`${range.from}-${range.to}`}
        seriesLabel={a.revenueSeries}
        formatValue={(v) => f.moneyCompact(v)}
        loading={busy}
      />
      <StatStrip
        columns={3}
        loading={busy}
        placeholders={9}
        tiles={
          fig
            ? [
                {
                  id: 'revenue',
                  label: t.revenue,
                  value: f.moneyCompact(fig.memberRevenuePaise),
                  note: t.revenueNote(f.number(fig.memberOrders)),
                  spark: days.length > 1 ? days.map((d) => d.value) : undefined,
                },
                {
                  id: 'withRewards',
                  label: t.withRewards,
                  value: f.number(fig.ordersWithRewards),
                  note: t.withRewardsNote,
                },
                {
                  id: 'redemptionRate',
                  label: t.redemptionRate,
                  value: formatRate(fig.redemptionRate),
                  note: t.redemptionRateNote,
                },
                {
                  id: 'memberAov',
                  label: t.memberAov,
                  value: money(memberAov),
                  note: t.memberAovNote(money(otherAov)),
                },
                {
                  id: 'activeMembers',
                  label: t.activeMembers,
                  value: f.number(fig.activeMembers),
                  note: t.activeMembersNote,
                },
                {
                  id: 'newMembers',
                  label: t.newMembers,
                  value: f.number(fig.newMembers),
                  note: t.newMembersNote,
                },
                { id: 'issued', label: t.issued, value: f.number(fig.pointsIssued) },
                {
                  id: 'redeemed',
                  label: t.redeemed,
                  value: f.number(fig.pointsRedeemed),
                  note: t.redeemedNote(f.number(fig.redemptions)),
                },
                {
                  id: 'expired',
                  label: t.expired,
                  value: f.number(fig.pointsExpired),
                  note: t.expiredNote,
                },
              ]
            : []
        }
      />
    </div>
  )
}
