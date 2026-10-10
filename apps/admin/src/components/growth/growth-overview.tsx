'use client'

import type { MarketingOverview } from '@commerce/api'
import { BadgePercent, LinkIcon, Send, Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import ChartCard from '@/components/layout/chart-card'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import { growthOverviewContent } from '@/data/growth'
import { useCopy } from '@/hooks/use-copy'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { formatPaiseCompact } from '@/lib/money'
import { routes } from '@/lib/routes'
import BestSourceCallout from './best-source-callout'
import GrowthKpiTile from './growth-kpi-tile'
import SourceOrChannelCard from './source-or-channel-card'
import TopCampaignsCard from './top-campaigns-card'

type GrowthOverviewPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
}

const SHORTCUTS = [
  { ...growthOverviewContent.shortcuts.campaigns, icon: Send },
  { ...growthOverviewContent.shortcuts.automations, icon: Workflow },
  { ...growthOverviewContent.shortcuts.links, icon: LinkIcon },
  { ...growthOverviewContent.shortcuts.discounts, icon: BadgePercent },
]

/** Growth overview: KPIs, sales by source and channel, and top campaigns. */
export default function GrowthOverviewPage({ initialRange, initial }: GrowthOverviewPageProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent)
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
  const dayPoints = data.salesOverTime.day.map((p) => ({ ...p, label: formatDay(p.label) }))
  const weekPoints = data.salesOverTime.week.map((p) => ({ ...p, label: formatDay(p.label) }))

  return (
    <div className="mx-auto flex w-full max-w-[81.5rem] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader
        title={copy.title}
        summary={copy.intro}
        actions={
          <div className="flex items-center gap-2">
            <RangePicker value={range} onChange={handleRange} />
            <Button render={<Link href={routes.growth.campaigns()} />} nativeButton={false}>
              {copy.createCampaign}
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy={loading || undefined}>
        {data.kpis.map((kpi) => (
          <GrowthKpiTile key={kpi.id} kpi={kpi} />
        ))}
      </div>
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
      {data.bestSource ? <BestSourceCallout source={data.bestSource} /> : null}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <SourceOrChannelCard
          sources={data.sources}
          channels={data.channels}
          campaigns={data.campaigns}
        />
        <TopCampaignsCard rows={data.campaigns} />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-card-title text-ink-strong">{copy.shortcuts.title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="group">
              <Card
                gap={3}
                inset={4}
                className="h-full flex-row items-start transition-colors group-hover:bg-muted/50"
              >
                <s.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="text-body-strong text-foreground">{s.title}</p>
                  <p className="text-caption text-muted-foreground">{s.body}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
