'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useEffect, useState } from 'react'

type NavFrameProps = { children: ReactNode }

const SHRINK_AT = 56
const RESTORE_AT = 16

/**
 * The nav bar: full width at the top, a narrower centred floating pill once the page scrolls.
 * Two thresholds (shrink past 56px, restore under 16px) keep it from flickering at the edge.
 */
export default function NavFrame({ children }: NavFrameProps) {
  // Hooks
  const [shrunk, setShrunk] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      setShrunk((current) => (current ? y > RESTORE_AT : y > SHRINK_AT))
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
    <header className="sticky top-4 z-30 mx-auto mt-4 w-full px-4 md:px-8 print:hidden">
      <nav
        aria-label="Main"
        data-shrunk={shrunk}
        className={cn(
          'glass-panel mx-auto flex h-14 w-full items-center justify-between rounded-full pr-2 pl-4 transition-[max-width,box-shadow] duration-500 ease-(--ease-drawer) motion-reduce:transition-none',
          shrunk ? 'max-w-[44rem] shadow-[0_0.5rem_2rem_-0.5rem_rgb(0_0_0/0.6)]' : 'max-w-[75rem]',
        )}
      >
        {children}
      </nav>
    </header>
  )
}
