'use client'

import type { CampaignPerformanceRow, MarketingOverview } from '@commerce/api'
import type { GrowthRecommendation } from '@commerce/core/marketing'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import PageBody from '@/components/layout/page-body'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AttributedSalesCard from './overview/attributed-sales-card'
import AutopilotHero from './overview/autopilot-hero'
import AutopilotStrip from './overview/autopilot-strip'
import RecentCampaignsCard from './overview/recent-campaigns-card'
import TopSourceCards from './overview/top-source-cards'
import TrafficTypeCard from './overview/traffic-type-card'
import RecommendationsCard from './recommendations-card'

type GrowthOverviewPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
  recommendations: GrowthRecommendation[]
  campaigns: CampaignPerformanceRow[]
  autopilot: { enabled: boolean; waiting: number }
}

/**
 * Growth overview, laid out like Shopify's: the Autopilot banner, Performance for the picked
 * range (sales attributed to marketing against the period before, sessions by traffic type,
 * recommendations, the top four sources), the Autopilot strip and the recent campaigns.
 * The full report is Attribution ("View details").
 */
export default function GrowthOverviewPage({
  initialRange,
  initial,
  recommendations,
  campaigns,
  autopilot,
}: GrowthOverviewPageProps) {
  // Hooks
  const copy = useCopy(growthHomeContent)
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
  const kpi = (id: string) => data.kpis.find((k) => k.id === id)

  return (
    <PageBody className="gap-8 md:pt-5 md:pb-8">
      <h1 className="sr-only">{copy.title}</h1>
      <AutopilotHero enabled={autopilot.enabled} waiting={autopilot.waiting} />
      <section className="flex flex-col gap-4" aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body-strong text-foreground">{copy.performance.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker value={range} onChange={handleRange} />
            <Button
              variant="ghost"
              render={<Link href={`${routes.growth.attribution()}${rangeQuery(range)}`} />}
              nativeButton={false}
            >
              {copy.performance.viewDetails}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttributedSalesCard
            attributed={kpi('attributed_sales')}
            total={kpi('total_sales')}
            days={data.range.days}
          />
          <TrafficTypeCard counts={data.trafficTypes} />
        </div>
        <TopSourceCards sources={data.sources} />
      </section>
      <RecommendationsCard initial={recommendations} />
      <AutopilotStrip enabled={autopilot.enabled} waiting={autopilot.waiting} />
      <RecentCampaignsCard rows={campaigns} />
    </PageBody>
  )
}
