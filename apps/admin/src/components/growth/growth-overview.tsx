'use client'

import type { MarketingOverview } from '@commerce/api'
import { ArrowRight, BadgePercent, LinkIcon, Plus, Send, Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import RangePicker from '@/components/analytics/range-picker'
import ChartCard from '@/components/layout/chart-card'
import PageHeader from '@/components/layout/page-header'
import SectionHead from '@/components/layout/section-head'
import StatStrip from '@/components/layout/stat-strip'
import { growthOverviewContent } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatDay, type RangeState, rangeQuery, sameRange } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { formatPaiseCompact } from '@/lib/money'
import { routes } from '@/lib/routes'
import BestSourceCallout from './best-source-callout'
import OutcomesCard from './outcomes-card'
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

/**
 * Growth overview (Figma "Marketing / Growth overview"): what marketing earned (sales from
 * campaigns, automations, discount codes and links, messages sent, subscribers), then sales
 * over time, by source and channel, and the top campaigns.
 */
export default function GrowthOverviewPage({ initialRange, initial }: GrowthOverviewPageProps) {
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
  const earnedTrend =
    o.earnedPrevPaise > 0
      ? Math.round(((o.earnedPaise - o.earnedPrevPaise) / o.earnedPrevPaise) * 1000) / 10
      : null
  const dayPoints = data.salesOverTime.day.map((p) => ({ ...p, label: formatDay(p.label) }))
  const weekPoints = data.salesOverTime.week.map((p) => ({ ...p, label: formatDay(p.label) }))

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
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
      <StatStrip
        variant="strip"
        loading={loading}
        tiles={[
          {
            id: 'earned',
            label: copy.outcomes.tiles.earned,
            value: fmt.money(o.earnedPaise),
            trend: earnedTrend,
            trendNote: copy.outcomes.vsPrevious,
          },
          {
            id: 'messages',
            label: copy.outcomes.tiles.messages,
            value: fmt.number(o.messages.email + o.messages.whatsapp),
            note: copy.outcomes.messagesNote(
              fmt.number(o.messages.whatsapp),
              fmt.number(o.messages.email),
            ),
          },
          {
            id: 'automationOrders',
            label: copy.outcomes.tiles.automationOrders,
            value: fmt.number(o.automationOrders),
            note: copy.outcomes.automationNote,
          },
          {
            id: 'subscribers',
            label: copy.outcomes.tiles.subscribers,
            value: fmt.number(o.subscribers.total),
            note: copy.outcomes.subscribersNote(fmt.number(o.subscribers.newThisWeek)),
          },
        ]}
      />
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <OutcomesCard outcomes={o} />
        {data.bestSource ? <BestSourceCallout source={data.bestSource} /> : null}
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
      <SourceOrChannelCard
        sources={data.sources}
        channels={data.channels}
        campaigns={data.campaigns}
      />
      <TopCampaignsCard rows={data.campaigns} />
      <section className="flex flex-col gap-3">
        <SectionHead title={copy.shortcuts.title} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="group">
              <Card gap={3} inset={4} className="h-full transition-colors group-hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-md border border-border">
                    <s.icon className="size-4 text-muted-foreground" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </div>
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
