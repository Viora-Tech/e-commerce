'use client'

import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react'
import { startDropReveal } from './drop-reveal-scrub'

type DropRevealHostProps = {
  count: number
  children: ReactNode
}

// The pinned host element of the drop reveal (Zero Drift's <drop-reveal>): renders the final frame
// on the server and starts the scroll-scrubbed timeline once mounted.
export default function DropRevealHost({ count, children }: DropRevealHostProps) {
  // Hooks
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    return startDropReveal(el)
  }, [])

  // Render logic
  return (
    <div ref={host} className="drop-reveal" style={{ '--n': count } as CSSProperties}>
      {children}
    </div>
  )
}
