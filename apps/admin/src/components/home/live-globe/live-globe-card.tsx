'use client'

import type { DashboardSummary } from '@commerce/api'
import { Globe as GlobeIcon } from '@commerce/ui/icons'
import { useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { buildGlobeData } from '@/components/analytics/live-globe/build-globe-data'
import LiveGlobeCanvas from '@/components/analytics/live-globe/live-globe-canvas'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { homeContent } from '@/data/home'
import { useLiveGlobeData } from '@/hooks/use-live-globe-data'
import { formatCompact, formatPaise } from '@/lib/money'
import { isWebglSupported } from '@/lib/webgl'

type LiveGlobeCardProps = {
  initial: DashboardSummary
}

/** Where the camera eases to on load: a point roughly in the middle of India. */
const INDIA_FOCUS = { lat: 22.35, lng: 78.6 }

/**
 * The home page's "Live view" card, after Shopify's Live View: a dotted cobe globe (no
 * country/state borders, unlike the old India SVG map) with the last 24h of orders as markers
 * and arcs from the store's dispatch address, plus today's counters. Polls for new orders
 * every ~20s while the tab is visible. Falls back to the order stream alone when WebGL is
 * unavailable. The globe itself (`components/analytics/live-globe`) is shared with the larger
 * hero on the Live view page.
 */
export default function LiveGlobeCard({ initial }: LiveGlobeCardProps) {
  // Hooks
  const { resolvedTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const data = useLiveGlobeData(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [webglOk, setWebglOk] = useState(true)

  useEffect(() => {
    if (!isWebglSupported()) setWebglOk(false)
  }, [])

  // Render logic
  const c = homeContent.liveGlobe
  const { markers, arcs } = buildGlobeData(data)
  const dark = resolvedTheme === 'dark'

  return (
    <DataCard title={c.title} meta={c.subtitle}>
      {markers.length === 0 ? (
        <EmptyState heading={c.empty} icon={GlobeIcon} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-caption text-muted-foreground">{c.ordersToday}</p>
              <p className="mt-0.5 text-card-title text-ink-strong tabular-nums">
                {formatCompact(data.today.ordersCount)}
              </p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">{c.salesToday}</p>
              <p className="mt-0.5 text-card-title text-ink-strong tabular-nums">
                {formatPaise(data.today.salesPaise)}
              </p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">{c.visitorsNow}</p>
              <p className="mt-0.5 text-card-title text-ink-strong tabular-nums">
                {formatCompact(data.liveVisitors.last30)}
              </p>
            </div>
          </div>
          {webglOk ? (
            <div className="mx-auto w-full max-w-80 sm:max-w-96">
              <LiveGlobeCanvas
                markers={markers}
                arcs={arcs}
                reducedMotion={Boolean(reducedMotion)}
                dark={dark}
                focus={INDIA_FOCUS}
                activeId={activeId}
                onActiveChange={setActiveId}
              />
            </div>
          ) : (
            <p className="text-body text-muted-foreground">{c.unsupported}</p>
          )}
          <p className="text-right text-caption text-muted-foreground">{c.credit}</p>
        </div>
      )}
    </DataCard>
  )
}
