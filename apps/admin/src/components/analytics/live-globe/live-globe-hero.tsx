'use client'

import type { DashboardSummary } from '@commerce/api'
import { useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { liveGlobeContent as copy } from '@/data/live-globe'
import { useLocale } from '@/hooks/use-copy'
import { useGlobeSettings } from '@/hooks/use-globe-settings'
import { useLiveGlobeData } from '@/hooks/use-live-globe-data'
import { isWebglSupported } from '@/lib/webgl'
import { buildGlobeData } from './build-globe-data'
import type { GlobeCanvasProps } from './types'

type LiveGlobeHeroProps = {
  initial: DashboardSummary
  /** The page title, summary and Pause button: a glass pill over the top-left of the globe. */
  header: ReactNode
  /** The stats card: the left edge on wide screens, stacked at the bottom on phones. */
  left: ReactNode
  /** The activity card: the right edge on wide screens, under the stats on phones. */
  right: ReactNode
}

/** Where the camera eases to on load: a point roughly in the middle of India. Also "Start
 * view: India" (the default) and the fallback for "My location" before it resolves, or if the
 * browser denies or lacks geolocation. */
const INDIA_FOCUS = { lat: 22.35, lng: 78.6 }

/** "Start view: Whole world": a fairly neutral point (its own setting also zooms further out,
 * see `webgl-globe-canvas.tsx`'s `WORLD_START_ZOOM`). */
const WORLD_FOCUS = { lat: 5, lng: 15 }

/** How long a browser geolocation position is trusted before asking again, and how long we
 * wait for one before giving up and falling back to India. */
const GEOLOCATION_MAX_AGE_MS = 600_000
const GEOLOCATION_TIMEOUT_MS = 8_000

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
export default function LiveGlobeHero({ initial, header, left, right }: LiveGlobeHeroProps) {
  // Hooks
  const locale = useLocale()
  const { resolvedTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const { settings, update, reset } = useGlobeSettings(Boolean(reducedMotion))
  const data = useLiveGlobeData(initial, settings.data.timeRange)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [webglOk, setWebglOk] = useState(true)
  const [Globe, setGlobe] = useState<ComponentType<GlobeCanvasProps> | null>(null)
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)

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
    // Only once the person has actually picked "My location", and only asked for once per
    // visit — a browser that already granted permission answers instantly; one that denies or
    // lacks geolocation just leaves `myLocation` null, so `focus` below falls back to India.
    if (settings.motion.startView !== 'mine' || myLocation || !navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!cancelled) {
          setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        }
      },
      () => {
        // Denied, timed out, or unavailable: `focus` below already falls back to India.
      },
      { maximumAge: GEOLOCATION_MAX_AGE_MS, timeout: GEOLOCATION_TIMEOUT_MS },
    )
    return () => {
      cancelled = true
    }
  }, [settings.motion.startView, myLocation])

  // Render logic
  const { markers, arcs } = buildGlobeData(data, locale)
  const dark = resolvedTheme === 'dark'
  const focus =
    settings.motion.startView === 'world'
      ? WORLD_FOCUS
      : settings.motion.startView === 'mine' && myLocation
        ? myLocation
        : INDIA_FOCUS

  return (
    <section className="relative size-full">
      {webglOk ? (
        <div className="absolute inset-0">
          {Globe ? (
            <Globe
              className="h-full"
              markers={markers}
              arcs={arcs}
              reducedMotion={Boolean(reducedMotion)}
              dark={dark}
              focus={focus}
              activeId={activeId}
              onActiveChange={setActiveId}
              settings={settings}
              onSettingsChange={update}
              onSettingsReset={reset}
            />
          ) : null}
          <p className="pointer-events-none absolute right-4 bottom-2 hidden text-caption text-muted-foreground lg:block">
            {copy.credit}
          </p>
        </div>
      ) : null}
      <div className="pointer-events-none relative z-10 flex size-full flex-col gap-3 p-3 md:p-5">
        {/* Stops short of the top-right, where the globe keeps its own gear and zoom buttons. */}
        <div className="glass-bar pointer-events-auto w-fit max-w-[calc(100%-9.5rem)] rounded-2xl px-4 py-3 md:max-w-[calc(100%-11rem)]">
          {header}
        </div>
        <p className="mx-auto hidden max-w-md text-center text-caption text-muted-foreground lg:block">
          {!webglOk
            ? copy.heroUnsupported
            : markers.length === 0
              ? copy.heroEmpty
              : copy.heroSubtitle}
        </p>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="pointer-events-auto flex max-h-[55%] min-w-0 flex-col gap-3 overflow-y-auto lg:max-h-full lg:w-[22rem] lg:shrink-0">
            {left}
          </div>
          <div className="pointer-events-auto flex max-h-[40%] min-w-0 flex-col gap-3 overflow-y-auto lg:max-h-full lg:w-[22rem] lg:shrink-0">
            {right}
          </div>
        </div>
      </div>
    </section>
  )
}
