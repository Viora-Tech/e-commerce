'use client'

import type { MarketingOverview } from '@commerce/api'
import { BadgePercent, LinkIcon, Send, Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import ChartCard from '@/components/layout/chart-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { growthOverviewContent as copy } from '@/data/growth'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { formatPaiseCompact } from '@/lib/money'
import BestSourceCallout from './best-source-callout'
import GrowthKpiTile from './growth-kpi-tile'
import SourceOrChannelCard from './source-or-channel-card'
import TopCampaignsCard from './top-campaigns-card'

type GrowthOverviewPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
}

const SHORTCUTS = [
  { ...copy.shortcuts.campaigns, icon: Send },
  { ...copy.shortcuts.automations, icon: Workflow },
  { ...copy.shortcuts.links, icon: LinkIcon },
  { ...copy.shortcuts.discounts, icon: BadgePercent },
]

/** Growth overview: KPIs, sales by source and channel, and top campaigns. */
export default function GrowthOverviewPage({ initialRange, initial }: GrowthOverviewPageProps) {
  // Hooks
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
    window.history.replaceState(null, '', `/growth${rangeQuery(next)}`)
  }

  // Render logic
  const dayPoints = data.salesOverTime.day.map((p) => ({ ...p, label: formatDay(p.label) }))
  const weekPoints = data.salesOverTime.week.map((p) => ({ ...p, label: formatDay(p.label) }))

  return (
    <PageBody width="frame" className="gap-5">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          <div className="flex items-center gap-2">
            <RangePicker value={range} onChange={handleRange} />
            <Button render={<Link href="/growth/campaigns" />} nativeButton={false}>
              {copy.createCampaign}
            </Button>
          </div>
        }
      />
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy={loading || undefined}
      >
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
        <h2 className="text-kit-title text-foreground">{copy.shortcuts.title}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="group">
              <Card className="h-full flex-row items-start gap-3 p-4 transition-colors group-hover:bg-muted/50">
                <s.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <p className="text-kit-body font-medium text-foreground">{s.title}</p>
                  <p className="text-kit-mini text-muted-foreground">{s.body}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </PageBody>
  )
}
