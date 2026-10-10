'use client'

// Port of assets/perfect-match.js: the ring's orbit (pure CSS) is paused while the section is
// off screen, so a visitor who cannot see it costs no battery. CSS owns the actual pausing
// (.is-paused, inside the reduced-motion guard), so reduced motion has nothing to pause.
import { type ReactNode, useEffect, useRef, useState } from 'react'

type PerfectMatchRingProps = {
  children: ReactNode
}

const MARGIN = '100px'

export default function PerfectMatchRing({ children }: PerfectMatchRingProps) {
  // Hooks
  const [offscreen, setOffscreen] = useState(false)
  const ring = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ring.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setOffscreen(!entries[0]?.isIntersecting),
      {
        rootMargin: MARGIN,
      },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ring} className={`perfect-match__ring${offscreen ? ' is-paused' : ''}`}>
      {children}
    </div>
  )
}
