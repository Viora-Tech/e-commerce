'use client'

import type { CampaignPerformanceRow, MarketingOverview } from '@commerce/api'
import type { GrowthRecommendation } from '@commerce/core/marketing'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import PageState from '@/components/states/page-state'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { type RangeState, rangeQuery } from '@/lib/analytics-range'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import GrowthKpiStrip from './growth-kpi-strip'
import AutopilotHero from './overview/autopilot-hero'
import AutopilotStrip from './overview/autopilot-strip'
import GoogleSearchCard from './overview/google-search-card'
import RecentCampaignsCard from './overview/recent-campaigns-card'
import TopSourceCards from './overview/top-source-cards'
import RecommendationsCard from './recommendations-card'
import { useOverviewRange } from './use-overview-range'

type GrowthOverviewPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
  recommendations: GrowthRecommendation[]
  campaigns: CampaignPerformanceRow[]
  /** Google Search Console's numbers for the Google Search card (#1022). */
  search: Awaited<ReturnType<typeof api.marketing.searchSummary>>
  autopilot: { enabled: boolean; waiting: number }
}

/**
 * Growth overview: the page title, the Autopilot banner, a short Performance summary for the
 * picked range (the tiles and the top four sources), recommendations, the Autopilot strip and
 * the recent campaigns. The charts are on Attribution only ("View details", audit #152).
 */
export default function GrowthOverviewPage({
  initialRange,
  initial,
  recommendations,
  campaigns,
  search,
  autopilot,
}: GrowthOverviewPageProps) {
  // Hooks
  const copy = useCopy(growthHomeContent)
  const [range, setRange] = useState(initialRange)
  const { data, loading, failed, retry } = useOverviewRange(range, initialRange, initial)

  // Event handlers
  const handleRange = (next: RangeState) => {
    setRange(next)
    window.history.replaceState(null, '', `${routes.growth.home()}${rangeQuery(next)}`)
  }

  // Render logic
  const attribution = `${routes.growth.attribution()}${rangeQuery(range)}`

  return (
    <PageBody>
      <PageHeader title={copy.title} summary={copy.summary} />
      <AutopilotHero enabled={autopilot.enabled} waiting={autopilot.waiting} />
      <section className="flex flex-col gap-4" aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body-strong text-foreground">{copy.performance.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker value={range} onChange={handleRange} />
            <Button variant="ghost" render={<Link href={attribution} />} nativeButton={false}>
              {copy.performance.viewDetails}
            </Button>
          </div>
        </div>
        {failed === 'no-access' ? (
          <PageState kind="no-access" />
        ) : failed ? (
          <PageState kind="error" heading={copy.performance.loadFailed} onRetry={retry} />
        ) : (
          <>
            <GrowthKpiStrip kpis={data.kpis} loading={loading} />
            <TopSourceCards sources={data.sources} />
          </>
        )}
        <p className="text-caption text-muted-foreground">
          {copy.performance.more}{' '}
          <Link href={attribution} className="text-foreground underline underline-offset-2">
            {copy.performance.open}
          </Link>
        </p>
      </section>
      <GoogleSearchCard summary={search} />
      <RecommendationsCard initial={recommendations} />
      <AutopilotStrip enabled={autopilot.enabled} waiting={autopilot.waiting} />
      <RecentCampaignsCard rows={campaigns} />
    </PageBody>
  )
}
