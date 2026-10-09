'use client'

import type { DashboardSummary } from '@commerce/api'
import { useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { buildGlobeData } from '@/components/analytics/live-globe/build-globe-data'
import LiveGlobeCanvas from '@/components/analytics/live-globe/live-globe-canvas'
import { homePageContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLiveGlobeData } from '@/hooks/use-live-globe-data'
import { isWebglSupported } from '@/lib/webgl'
import SectionHead from './section-head'

type LiveNowProps = {
  initial: DashboardSummary
}

/** Where the camera eases to on load: a point roughly in the middle of India. */
const INDIA_FOCUS = { lat: 22.35, lng: 78.6 }

/**
 * "Live now": visitors on the store right now, today's orders and sales, and the dotted
 * globe cropped to its top half at the bottom of the card. Polls every ~20s while the tab is
 * visible. Without WebGL (or any order with an address) the numbers stand alone.
 */
export default function LiveNow({ initial }: LiveNowProps) {
  // Hooks
  const content = useCopy(homePageContent)
  const fmt = useFormat()
  const { resolvedTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const data = useLiveGlobeData(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [webglOk, setWebglOk] = useState(true)

  useEffect(() => {
    if (!isWebglSupported()) setWebglOk(false)
  }, [])

  // Render logic
  const copy = content.live
  const { markers, arcs } = buildGlobeData(data, fmt.locale)
  const visitors = data.liveVisitors.last30

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHead
        title={
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            {copy.title}
          </span>
        }
      />
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl surface-card">
        <div className="flex flex-col gap-0.5 p-6">
          <p className="font-[family-name:var(--font-display)] text-[2.5rem] leading-[2.75rem] font-bold tracking-tight text-ink-strong tabular-nums">
            {fmt.compact(visitors)}
          </p>
          <p className="text-caption font-normal text-muted-foreground">
            {copy.visitors(visitors)}
          </p>
          <p className="text-caption font-normal text-muted-foreground">
            {copy.today(copy.ordersWord(data.today.ordersCount), fmt.money(data.today.salesPaise))}
          </p>
        </div>
        {webglOk ? (
          <div className="relative mt-auto h-[11.375rem] overflow-hidden">
            <div className="mx-auto w-[min(100%,28rem)]">
              <LiveGlobeCanvas
                markers={markers}
                arcs={arcs}
                reducedMotion={Boolean(reducedMotion)}
                dark={resolvedTheme === 'dark'}
                focus={INDIA_FOCUS}
                activeId={activeId}
                onActiveChange={setActiveId}
                brand
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
