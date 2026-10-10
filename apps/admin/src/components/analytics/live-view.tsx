'use client'

import type { AnalyticsLive, DashboardSummary } from '@commerce/api'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useEffect, useState } from 'react'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import StatTile from '@/components/layout/stat-tile'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatCompact, formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import LiveEventRow from './live-event-row'
import LiveGlobeHero from './live-globe/live-globe-hero'

type LiveViewProps = { initial: AnalyticsLive; globe: DashboardSummary }

const POLL_MS = 15_000

/** The activity card floats over the globe: see-through enough to feel part of it, still readable. */
const FLOATING_CARD = 'gap-0 bg-card/85 p-5 shadow-lift backdrop-blur-md'

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
  return (
    <div className="mx-auto flex w-full max-w-[81.5rem] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader
        title={c.title}
        summary={c.people(data.visitors.last30)}
        back={{ label: analyticsContent.title, href: routes.analytics.home() }}
        actions={
          <Button variant="outline" onClick={() => setPaused((p) => !p)}>
            {paused ? c.resume : c.pause}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr">
        <StatTile
          label={c.visitors}
          value={formatCompact(data.visitors.last30)}
          className="bg-primary-soft shadow-[inset_0_0_0_1px_var(--primary)]"
        />
        <StatTile label={c.activeCarts} value={formatCompact(data.activeCarts)} />
        <StatTile label={c.ordersLastHour} value={formatCompact(data.ordersLastHour)} />
        <StatTile label={c.revenueLastHour} value={formatPaise(data.revenueLastHourPaise)} />
      </div>
      <LiveGlobeHero initial={globe}>
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
      </LiveGlobeHero>
    </div>
  )
}
