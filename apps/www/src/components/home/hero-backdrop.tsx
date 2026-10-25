'use client'

import { cn } from '@commerce/ui/lib/utils'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// Loaded on the client only, after the page has settled: the hero text never waits on it.
const HeroShader = dynamic(() => import('./hero-shader'), { ssr: false })

/** The hero's WebGL aurora and grain, mounted when the browser is idle and faded in once drawn. */
export default function HeroBackdrop() {
  // Hooks
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // The aurora is the last thing to arrive, well after the globe, so page load stays light.
    const start = () => setTimeout(() => setMounted(true), 1200)
    if ('requestIdleCallback' in window) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const id = window.requestIdleCallback(
        () => {
          timer = start()
        },
        { timeout: 1500 },
      )
      return () => {
        window.cancelIdleCallback(id)
        clearTimeout(timer)
      }
    }
    const id = start()
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 transition-opacity duration-1000 ease-out motion-reduce:transition-none',
        ready ? 'opacity-100' : 'opacity-0',
      )}
    >
      {mounted ? <HeroShader onReady={() => setReady(true)} /> : null}
    </div>
  )
}
