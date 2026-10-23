'use client'

import type { MarketingOverview } from '@commerce/api'
import type { GrowthRecommendation } from '@commerce/core/marketing'
import { LinkIcon, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import ChartCard from '@/components/layout/chart-card'
import PageHeader from '@/components/layout/page-header'
import { growthOverviewContent } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { formatPaiseCompact } from '@/lib/money'
import { routes } from '@/lib/routes'
import BestSourceCallout from './best-source-callout'
import GrowthKpiStrip from './growth-kpi-strip'
import OutcomesCard from './outcomes-card'
import RecommendationsCard from './recommendations-card'
import SourceOrChannelCard from './source-or-channel-card'
import TopCampaignsCard from './top-campaigns-card'

type GrowthOverviewPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
  recommendations: GrowthRecommendation[]
}

/**
 * Growth overview (Figma "Marketing / Growth overview"): Shopify's tiles (sessions, conversion,
 * AOV, total sales, sales from marketing), recommendations, what marketing earned, then sales
 * over time, by source and channel, and the top campaigns.
 */
export default function GrowthOverviewPage({
  initialRange,
  initial,
  recommendations,
}: GrowthOverviewPageProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent)
  const fmt = useFormat()
  const [range, setRange] = useState(initialRange)
  const [data, setData] = useState(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sameRange(range, initialRange)) {
      setData(initial)
      return
    }
    let live = true
    setLoading(true)
    api.marketing
      .overview({ range })
      .then((next) => {
        if (live) setData(next)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [range, initialRange, initial])

  // Event handlers
  const handleRange = (next: RangeState) => {
    setRange(next)
    window.history.replaceState(null, '', `${routes.growth.home()}${rangeQuery(next)}`)
  }

  // Render logic
  const o = data.outcomes
  const dayPoints = data.salesOverTime.day.map((p) => ({ ...p, label: formatDay(p.label) }))
  const weekPoints = data.salesOverTime.week.map((p) => ({ ...p, label: formatDay(p.label) }))

  const bestRow = data.sources.find((r) => r.source === data.bestSource) ?? null

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.title}
        summary={copy.intro}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              render={<Link href={routes.growth.links()} />}
              nativeButton={false}
            >
              <LinkIcon aria-hidden />
              {copy.links}
            </Button>
            <Button render={<Link href={routes.growth.newCampaign()} />} nativeButton={false}>
              <Plus aria-hidden />
              {copy.newCampaign}
            </Button>
          </div>
        }
      />
      {/* Figma 658:64823: the range on its own row, with what growth brought in beside it. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <RangePicker value={range} onChange={handleRange} />
        <span className="text-caption text-muted-foreground">
          {copy.outcomes.summary(
            fmt.money(o.earnedPaise),
            copy.outcomes.periods[data.range.key] ?? copy.outcomes.periods.custom ?? '',
          )}
        </span>
      </div>
      <GrowthKpiStrip kpis={data.kpis} loading={loading} />
      <RecommendationsCard initial={recommendations} />
      {bestRow ? (
        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <OutcomesCard outcomes={o} />
          <BestSourceCallout source={bestRow} />
        </div>
      ) : (
        <OutcomesCard outcomes={o} />
      )}
      <ChartCard
        title={copy.salesOverTime.title}
        periods={[
          { id: 'day', label: copy.salesOverTime.day, data: dayPoints },
          { id: 'week', label: copy.salesOverTime.week, data: weekPoints },
        ]}
        seriesKey={`marketing-sales-${range.key}`}
        seriesLabel={copy.salesOverTime.series}
        formatValue={formatPaiseCompact}
      />
      <SourceOrChannelCard
        sources={data.sources}
        channels={data.channels}
        campaigns={data.campaigns}
      />
      <TopCampaignsCard rows={data.campaigns} />
    </div>
  )
}
