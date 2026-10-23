'use client'

import type { MarketingOverview } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { growthOverviewContent } from '@/data/growth'
import { growthAttributionContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import BestSourceCallout from './best-source-callout'
import GrowthKpiStrip from './growth-kpi-strip'
import OutcomesCard from './outcomes-card'
import AttributedSalesCard from './overview/attributed-sales-card'
import ChannelsChartCard from './overview/channels-chart-card'
import SessionsCard from './overview/sessions-card'
import TrafficTypeCard from './overview/traffic-type-card'
import SourceOrChannelCard from './source-or-channel-card'
import TopCampaignsCard from './top-campaigns-card'

type AttributionPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
}

/**
 * Growth → Attribution, the detailed report behind the overview: the tiles against the
 * previous period, sessions by traffic type, how credit is given, attributed sales and
 * sessions over time, a by-channel chart, sales by source or channel (first-time vs returning, paid/organic, campaigns under
 * each source), what marketing earned and the top campaigns.
 */
export default function AttributionPage({ initialRange, initial }: AttributionPageProps) {
  // Hooks
  const copy = useCopy(growthAttributionContent)
  const report = useCopy(growthOverviewContent)
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
    window.history.replaceState(null, '', `${routes.growth.attribution()}${rangeQuery(next)}`)
  }

  // Render logic
  const kpi = (id: string) => data.kpis.find((k) => k.id === id)
  const o = data.outcomes
  const bestRow = data.sources.find((r) => r.source === data.bestSource) ?? null

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.title}
        summary={copy.summary}
        back={{ label: copy.back, href: routes.growth.home() }}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <RangePicker value={range} onChange={handleRange} />
        <span className="text-caption text-muted-foreground">{copy.compare}</span>
      </div>
      <GrowthKpiStrip kpis={data.kpis} loading={loading} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrafficTypeCard counts={data.trafficTypes} />
        <Card inset={5} gap={3}>
          <p className="text-body-strong text-foreground">{copy.model.title}</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-caption text-foreground">
              {copy.model.rule}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-caption text-foreground">
              {copy.model.window}
            </span>
          </div>
          <p className="text-caption text-muted-foreground">{copy.model.body}</p>
        </Card>
      </div>
      <AttributedSalesCard
        attributed={kpi('attributed_sales')}
        total={kpi('total_sales')}
        days={data.range.days}
        detailed
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SessionsCard sessions={kpi('sessions')} days={data.range.days} detailed />
        <ChannelsChartCard channels={data.channels} detailed />
      </div>
      <SourceOrChannelCard
        sources={data.sources}
        channels={data.channels}
        campaigns={data.campaigns}
      />
      {bestRow ? (
        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <OutcomesCard outcomes={o} />
          <BestSourceCallout source={bestRow} />
        </div>
      ) : (
        <OutcomesCard outcomes={o} />
      )}
      <p className="text-caption text-muted-foreground">
        {report.outcomes.summary(
          fmt.money(o.earnedPaise),
          report.outcomes.periods[data.range.key] ?? report.outcomes.periods.custom ?? '',
        )}
      </p>
      <TopCampaignsCard rows={data.campaigns} />
    </PageBody>
  )
}
