'use client'

import type { AnalyticsLive } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import CountUp from '@/components/layout/count-up'
import MiniBars from '@/components/layout/mini-bars'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent as copy } from '@/data/analytics'
import { api } from '@/lib/api-client'
import { formatCompact, formatPaise } from '@/lib/money'
import LiveEventRow from './live-event-row'

type LiveViewProps = { initial: AnalyticsLive }

const POLL_MS = 15_000

/** Visitors, carts and orders as they happen; refreshes itself every 15 seconds. */
export default function LiveView({ initial }: LiveViewProps) {
  // Hooks
  const [data, setData] = useState(initial)

  useEffect(() => {
    let live = true
    const tick = () => {
      api.analytics.live().then((next) => {
        if (live) setData(next)
      })
    }
    const timer = setInterval(tick, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  // Render logic
  const c = copy.live
  const bars = data.visitors.perMinute.map((value, i) => ({ label: String(i), value }))

  return (
    <PageBody width="frame" className="gap-5">
      <PageHeader title={c.title} subtitle={c.updating} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,739fr)_minmax(0,361fr)]">
        <Card className="gap-0 p-5">
          <p className="text-kit-body text-muted-foreground">{c.visitors}</p>
          <p className="mt-2 text-kit-stat text-ink-strong tabular-nums">
            <CountUp value={formatCompact(data.visitors.last30)} />
          </p>
          <p className="mt-6 text-kit-body font-medium text-muted-foreground">{c.perMinute}</p>
          <MiniBars data={bars} className="mt-3 h-16" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-kit-mini text-muted-foreground-soft">{c.activeCarts}</p>
              <p className="mt-1 text-kit-stat-sm text-foreground tabular-nums">
                {formatCompact(data.activeCarts)}
              </p>
            </div>
            <div>
              <p className="text-kit-mini text-muted-foreground-soft">{c.ordersLastHour}</p>
              <p className="mt-1 text-kit-stat-sm text-foreground tabular-nums">
                {formatCompact(data.ordersLastHour)}
              </p>
            </div>
            <div>
              <p className="text-kit-mini text-muted-foreground-soft">{c.revenueLastHour}</p>
              <p className="mt-1 text-kit-stat-sm text-foreground tabular-nums">
                {formatPaise(data.revenueLastHourPaise)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <p className="text-kit-title text-foreground">{c.events}</p>
          {data.events.length === 0 ? (
            <p className="mt-5 text-kit-body text-muted-foreground">{c.eventsEmpty}</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {data.events.map((event) => (
                <LiveEventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageBody>
  )
}
