'use client'

import type { MarketingOverview } from '@commerce/api'
import { BadgePercent, Send, Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import ChartCard from '@/components/layout/chart-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { marketingOverviewContent as copy } from '@/data/marketing'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { formatPaiseCompact } from '@/lib/money'
import ChannelTableCard from './channel-table-card'
import MarketingKpiTile from './marketing-kpi-tile'
import TopCampaignsCard from './top-campaigns-card'

type MarketingOverviewPageProps = {
  initialRange: RangeState
  initial: MarketingOverview
}

const SHORTCUTS = [
  { ...copy.shortcuts.campaigns, icon: Send },
  { ...copy.shortcuts.automations, icon: Workflow },
  { ...copy.shortcuts.discounts, icon: BadgePercent },
]

/** Marketing overview (Shopify Marketing): KPIs, attributed sales, channels and top campaigns. */
export default function MarketingOverviewPage({
  initialRange,
  initial,
}: MarketingOverviewPageProps) {
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
    window.history.replaceState(null, '', `/marketing${rangeQuery(next)}`)
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
            <Button render={<Link href="/marketing/campaigns" />} nativeButton={false}>
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
          <MarketingKpiTile key={kpi.id} kpi={kpi} />
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
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <ChannelTableCard rows={data.channels} />
        <TopCampaignsCard rows={data.campaigns} />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-kit-title text-foreground">{copy.shortcuts.title}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
