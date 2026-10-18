'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { base, ENTER_RISE_PX, enter, HOME_ENTERED_KEY, MOTION_MS } from '@/lib/motion'

type HomeEnterProps = {
  /** Position in the page stack: each section settles 40ms after the previous one. */
  index: number
  children: ReactNode
}

let firstHomeVisit: boolean | null = null

function isFirstHomeVisit(): boolean {
  if (firstHomeVisit !== null) return firstHomeVisit
  try {
    if (window.sessionStorage.getItem(HOME_ENTERED_KEY)) {
      firstHomeVisit = false
      return false
    }
    window.sessionStorage.setItem(HOME_ENTERED_KEY, '1')
    firstHomeVisit = true
    return true
  } catch {
    firstHomeVisit = true
    return true
  }
}

/**
 * One Home section's entrance (motion spec 01) and the skeleton crossfade (spec 12): on the
 * first Home visit of a session each section fades in with an 8px rise, staggered 40ms; on
 * every later visit the section only fades in over 200ms as the skeleton swaps out.
 */
export default function HomeEnter({ index, children }: HomeEnterProps) {
  // Hooks
  const reduced = useReducedMotion()
  const [first] = useState(() => (typeof window === 'undefined' ? true : isFirstHomeVisit()))

  // Early returns
  if (reduced) {
    return <>{children}</>
  }

  // Render logic
  const rise = first
    ? {
        duration: MOTION_MS.enter / 1000,
        ease: enter.ease,
        delay: (index * MOTION_MS.stagger) / 1000,
      }
    : { duration: MOTION_MS.base / 1000, ease: base.ease, delay: 0 }

  return (
    <motion.div
      suppressHydrationWarning
      initial={{ opacity: 0, y: first ? ENTER_RISE_PX : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={rise}
    >
      {children}
    </motion.div>
  )
}
