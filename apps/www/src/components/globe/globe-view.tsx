'use client'

import { isWebglSupported } from '@commerce/ui/globe/support'
import { cn } from '@commerce/ui/lib/utils'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { type MutableRefObject, useEffect, useState } from 'react'
import { globeContent } from '@/data/demo-orders'
import type { GlobeApi } from './globe-api'

type GlobeViewProps = {
  /** Demo order pins and chips (hero only). */
  pins?: boolean
  className?: string
  priority?: boolean
  /** Receives the globe's controls once it is running (the hero's build sequence uses them). */
  apiRef?: MutableRefObject<GlobeApi | null>
}

// The WebGL globe loads on the client only, after the page is interactive.
const InteractiveGlobe = dynamic(() => import('./interactive-globe'), { ssr: false })

/**
 * The marketing globe at the Figma size: the static raster paints first (and stays when WebGL is
 * missing), then the interactive WebGL globe fades in over it once it has drawn a frame.
 */
export default function GlobeView({
  pins = false,
  className,
  priority = false,
  apiRef,
}: GlobeViewProps) {
  // Hooks
  const [supported, setSupported] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Give the page a moment to settle before the WebGL globe starts.
    const timer = setTimeout(() => setSupported(isWebglSupported()), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={cn('relative aspect-[1056/480] w-[130%] max-w-none md:w-[66rem]', className)}>
      <Image
        src="/images/globe.png"
        alt={globeContent.alt}
        width={1056}
        height={480}
        priority={priority}
        className="size-full"
      />
      {supported ? (
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        >
          <InteractiveGlobe pins={pins} apiRef={apiRef} onReady={() => setReady(true)} />
        </div>
      ) : null}
    </div>
  )
}
