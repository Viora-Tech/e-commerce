'use client'

import type { DashboardSummary } from '@commerce/api'
import { useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { liveGlobeContent as copy } from '@/data/live-globe'
import { useLocale } from '@/hooks/use-copy'
import { useLiveGlobeData } from '@/hooks/use-live-globe-data'
import { isWebglSupported } from '@/lib/webgl'
import { buildGlobeData } from './build-globe-data'
import type { GlobeCanvasProps } from './types'

type LiveGlobeHeroProps = {
  initial: DashboardSummary
  /** The live stats, floated over the left of the globe on wide screens, below it on phones. */
  children: ReactNode
}

/** Where the camera eases to on load: a point roughly in the middle of India. */
const INDIA_FOCUS = { lat: 22.35, lng: 78.6 }

/** On wide screens the globe sits right of centre so the stats column never hides it. */
const WIDE_QUERY = '(min-width: 64rem)'
const WIDE_SHIFT = 0.16

/** Our WebGL globe (`webgl-globe-canvas.tsx`), fetched only on this page and only once the
 * stats have painted, so it never delays them. */
function loadGlobe(): Promise<ComponentType<GlobeCanvasProps>> {
  return import('./webgl-globe-canvas').then((module) => module.default)
}

/**
 * The Live view stage (Shopify Live View): our own WebGL globe (lazy-loaded, see `loadGlobe`)
 * fills the whole panel as a free-flowing backdrop, and the stats float above it. Zooming
 * grows the globe underneath the cards.
 */
export default function LiveGlobeHero({ initial, children }: LiveGlobeHeroProps) {
  // Hooks
  const locale = useLocale()
  const { resolvedTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const data = useLiveGlobeData(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [webglOk, setWebglOk] = useState(true)
  const [wide, setWide] = useState(false)
  const [Globe, setGlobe] = useState<ComponentType<GlobeCanvasProps> | null>(null)

  useEffect(() => {
    if (!isWebglSupported()) {
      setWebglOk(false)
      return
    }
    // Two frames after mount the stats are on screen; then fetch and start the globe.
    let cancelled = false
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        loadGlobe().then((component) => {
          if (!cancelled) setGlobe(() => component)
        })
      }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY)
    const sync = () => setWide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Render logic
  const { markers, arcs } = buildGlobeData(data, locale)
  const dark = resolvedTheme === 'dark'

  return (
    <section className="relative -mx-4 -mb-5 md:-mx-6 md:-mb-6 lg:h-[calc(100svh-8.5rem)] lg:min-h-[38rem]">
      {webglOk ? (
        <div className="relative h-[24rem] lg:absolute lg:inset-0 lg:h-auto">
          {Globe ? (
            <Globe
              className="h-full"
              shiftX={wide ? WIDE_SHIFT : 0}
              markers={markers}
              arcs={arcs}
              reducedMotion={Boolean(reducedMotion)}
              dark={dark}
              focus={INDIA_FOCUS}
              activeId={activeId}
              onActiveChange={setActiveId}
            />
          ) : null}
          <p className="pointer-events-none absolute right-12 bottom-3 text-caption text-muted-foreground">
            {copy.credit}
          </p>
        </div>
      ) : null}
      <div className="relative z-10 flex flex-col gap-4 p-4 lg:pointer-events-none lg:absolute lg:inset-y-0 lg:left-0 lg:w-[26rem] lg:overflow-y-auto [&>*]:pointer-events-auto">
        <div className="rounded-xl bg-card/80 px-4 py-3 backdrop-blur-sm">
          <p className="text-kit-title text-foreground">{copy.heroTitle}</p>
          <p className="text-kit-body text-muted-foreground">
            {!webglOk
              ? copy.heroUnsupported
              : markers.length === 0
                ? copy.heroEmpty
                : copy.heroSubtitle}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}
