'use client'

import GlobeView from '../../globe/globe-view'
import { useHeroDemo } from './hero-demo-context'

/** The hero globe: parallaxes with the cursor and hands its controls to the build sequence. */
export default function HeroGlobe() {
  // Hooks
  const { globeApiRef } = useHeroDemo()

  return (
    <GlobeView
      pins
      priority
      apiRef={globeApiRef}
      className="pointer-events-auto absolute bottom-0 left-1/2 [translate:calc(-50%+var(--px,0)*-0.4rem)_calc(var(--py,0)*-0.2rem)] transition-[translate] duration-500 ease-(--ease-out) motion-reduce:transition-none"
    />
  )
}
