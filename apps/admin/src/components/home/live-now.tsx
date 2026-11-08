'use client'

import type { DashboardSummary } from '@commerce/api'
import { motion, useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { buildGlobeData } from '@/components/analytics/live-globe/build-globe-data'
import SectionHead from '@/components/layout/section-head'
import { homePageContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLiveGlobeData } from '@/hooks/use-live-globe-data'
import { MOTION_MS } from '@/lib/motion'
import { isWebglSupported } from '@/lib/webgl'
import RollingNumber from './rolling-number'

type LiveNowProps = {
  initial: DashboardSummary
}

/* cobe and the globe's overlay load in their own chunk once the card knows WebGL works; the
   card keeps its fixed height meanwhile, so nothing moves. */
const LiveGlobeCanvas = dynamic(
  () => import('@/components/analytics/live-globe/live-globe-canvas'),
  {
    ssr: false,
  },
)

/** Where the camera eases to on load: a point roughly in the middle of India. */
const INDIA_FOCUS = { lat: 22.35, lng: 78.6 }

const TOP_CITIES = 3

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

function topCities(orders: DashboardSummary['mapOrders']): { city: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const order of orders) {
    const city = order.city.trim()
    if (!city) continue
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  return [...counts]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_CITIES)
}

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
  const [tabVisible, setTabVisible] = useState(() => isPageVisible())

  useEffect(() => {
    if (!isWebglSupported()) setWebglOk(false)
  }, [])

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Render logic
  const copy = content.live
  const { markers, arcs } = buildGlobeData(data, fmt.locale)
  const visitors = data.liveVisitors.last30
  const cities = topCities(data.mapOrders)

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHead
        title={
          <span className="flex items-center gap-2">
            <span className="relative flex size-4 items-center justify-center" aria-hidden="true">
              {!reducedMotion && tabVisible ? (
                <motion.span
                  animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
                  transition={{
                    duration: MOTION_MS.ambient / 1000,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                  className="absolute inline-flex size-2 rounded-full bg-foreground"
                />
              ) : null}
              <span className="relative inline-flex size-2 rounded-full bg-foreground ring-4 ring-foreground/15" />
            </span>
            {copy.title}
          </span>
        }
      />
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg surface-card">
        <div className="flex flex-col gap-0.5 px-6 pt-6">
          <RollingNumber
            value={fmt.compact(visitors)}
            className="font-[family-name:var(--font-display)] text-[2.5rem] leading-[2.875rem] font-semibold tracking-[-0.0625rem] text-ink-strong tabular-nums"
          />
          <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
            {copy.visitors(visitors)}
          </p>
          <p className="text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
            {copy.today(
              copy.ordersWord(data.today.ordersCount),
              fmt.moneyWhole(data.today.salesPaise),
            )}
          </p>
          {cities.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {cities.map((c) => (
                <li
                  key={c.city}
                  className="rounded-full border border-border px-2 py-0.5 text-caption whitespace-nowrap text-muted-foreground tabular-nums"
                >
                  {c.city} · {c.count}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {webglOk ? (
          <div className="relative mt-auto h-[14rem] overflow-hidden">
            <div className="h-full w-full">
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
