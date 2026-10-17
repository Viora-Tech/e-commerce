'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useEffect, useRef, useState } from 'react'

type NavFrameProps = { children: ReactNode }

const SHRINK_AT = 56
const RESTORE_AT = 16

const BAR =
  'glass-panel relative flex h-14 w-full items-center justify-between rounded-full pr-2 pl-4 transition-[opacity,scale] duration-[400ms] ease-(--ease-out) motion-reduce:transition-none'

/**
 * The nav bar. At the top it is the full-width bar; once the page scrolls it crossfades into a narrower
 * floating pill. Two stacked bars cross-fade and scale a hair (opacity and transform only, no width
 * animation), so nothing re-flows. Two thresholds (shrink past 56px, restore under 16px) stop it
 * flickering at the edge, and the scroll listener writes one state flip, not one per frame.
 */
export default function NavFrame({ children }: NavFrameProps) {
  // Hooks
  const [shrunk, setShrunk] = useState(false)
  const shrunkRef = useRef(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const next = shrunkRef.current ? y > RESTORE_AT : y > SHRINK_AT
      if (next !== shrunkRef.current) {
        shrunkRef.current = next
        setShrunk(next)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <header className="sticky top-4 z-30 mx-auto mt-4 w-full max-w-[79rem] px-4 md:px-8 print:hidden">
      <div className="relative mx-auto w-full max-w-[75rem]">
        <nav
          aria-label="Main"
          data-shrunk={shrunk}
          inert={shrunk}
          className={cn(BAR, shrunk ? 'pointer-events-none scale-[0.97] opacity-0' : 'opacity-100')}
        >
          {children}
        </nav>
        <nav
          aria-label="Main (compact)"
          inert={!shrunk}
          className={cn(
            BAR,
            'absolute top-0 left-1/2 max-w-[44rem] -translate-x-1/2 shadow-[0_0.5rem_2rem_-0.5rem_rgb(0_0_0/0.6)]',
            shrunk ? 'opacity-100' : 'pointer-events-none scale-[1.04] opacity-0',
          )}
        >
          {children}
        </nav>
      </div>
    </header>
  )
}
