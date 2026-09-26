'use client'

import type { DashboardSummary } from '@commerce/api'
import { Globe as GlobeIcon } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import { useReducedMotion } from 'motion/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { liveGlobeContent as copy } from '@/data/live-globe'
import { useLiveGlobeData } from '@/hooks/use-live-globe-data'
import { isWebglSupported } from '@/lib/webgl'
import { buildGlobeData } from './build-globe-data'
import LiveGlobeCanvas from './live-globe-canvas'

type LiveGlobeHeroProps = {
  initial: DashboardSummary
}

/** Where the camera eases to on load: a point roughly in the middle of India. */
const INDIA_FOCUS = { lat: 22.35, lng: 78.6 }

/**
 * The Live view page's hero: the same live-orders globe as the Home card, shown larger, with
 * the same drag-to-rotate, wheel/pinch/button zoom and reduced-motion handling.
 */
export default function LiveGlobeHero({ initial }: LiveGlobeHeroProps) {
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
  const { markers, arcs } = buildGlobeData(data)
  const dark = resolvedTheme === 'dark'

  return (
    <Card className="gap-4 p-5">
      <div>
        <p className="text-kit-title text-foreground">{copy.heroTitle}</p>
        <p className="text-kit-body text-muted-foreground">{copy.heroSubtitle}</p>
      </div>
      {markers.length === 0 ? (
        <EmptyState heading={copy.heroEmpty} icon={GlobeIcon} />
      ) : webglOk ? (
        <div className="mx-auto w-full max-w-[28rem] sm:max-w-[34rem] lg:max-w-[40rem]">
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
        <p className="text-body text-muted-foreground">{copy.heroUnsupported}</p>
      )}
    </Card>
  )
}
