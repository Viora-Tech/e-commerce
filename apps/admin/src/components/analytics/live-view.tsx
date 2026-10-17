'use client'

import type { AnalyticsLive, DashboardSummary } from '@commerce/api'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import CountUp from '@/components/layout/count-up'
import MiniBars from '@/components/layout/mini-bars'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatCompact, formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import LiveEventRow from './live-event-row'
import LiveGlobeHero from './live-globe/live-globe-hero'

type LiveViewProps = { initial: AnalyticsLive; globe: DashboardSummary }

const POLL_MS = 15_000

/** Stats and activity cards float over the globe on the glass surface (solid under reduced transparency). */
const FLOATING_CARD = 'glass-bar gap-0 bg-glass-bar p-5'

/** Visitors, carts and orders as they happen, with the live orders globe; refreshes itself every
 *  15 seconds. The globe polls dashboard data on its own, independent cadence. */
export default function LiveView({ initial, globe }: LiveViewProps) {
  // Hooks
  const { live: c } = useCopy(analyticsContent)
  const [data, setData] = useState(initial)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
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
  }, [paused])

  // Render logic
  const bars = data.visitors.perMinute.map((value, i) => ({ label: String(i), value }))

  return (
    <div className="h-[calc(100svh-3.5rem)] min-h-[34rem] w-full md:h-[calc(100svh-4rem)]">
      <LiveGlobeHero
        initial={globe}
        header={
          <PageHeader
            title={c.title}
            summary={c.people(data.visitors.last30)}
            back={{ label: analyticsContent.title, href: routes.analytics.home() }}
            actions={
              <Button variant="outline" onClick={() => setPaused((p) => !p)}>
                {paused ? c.resume : c.pause}
              </Button>
            }
          />
        }
        left={
          <Card className={FLOATING_CARD}>
            <p className="text-body text-muted-foreground">{c.visitors}</p>
            <p className="mt-2 text-stat text-ink-strong tabular-nums">
              <CountUp value={formatCompact(data.visitors.last30)} />
            </p>
            <p className="mt-5 text-body font-medium text-muted-foreground">{c.perMinute}</p>
            <MiniBars data={bars} className="mt-3 h-14" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div>
                <p className="text-caption text-muted-foreground">{c.activeCarts}</p>
                <p className="mt-1 text-stat-sm text-foreground tabular-nums">
                  {formatCompact(data.activeCarts)}
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">{c.ordersLastHour}</p>
                <p className="mt-1 text-stat-sm text-foreground tabular-nums">
                  {formatCompact(data.ordersLastHour)}
                </p>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">{c.revenueLastHour}</p>
                <p className="mt-1 text-stat-sm text-foreground tabular-nums">
                  {formatPaise(data.revenueLastHourPaise)}
                </p>
              </div>
            </div>
          </Card>
        }
        right={
          <Card className={FLOATING_CARD}>
            <p className="text-card-title text-foreground">{c.events}</p>
            {data.events.length === 0 ? (
              <p className="mt-4 text-body text-muted-foreground">{c.eventsEmpty}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {data.events.map((event) => (
                  <LiveEventRow key={event.id} event={event} />
                ))}
              </ul>
            )}
          </Card>
        }
      />
    </div>
  )
}
