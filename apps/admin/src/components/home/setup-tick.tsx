'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT, MOTION_MS } from '@/lib/motion'

/** The set-up step's tick, drawing itself once when the step is done (motion spec 04). */
export default function SetupTick() {
  // Hooks
  const reduced = useReducedMotion()

  // Early returns
  if (reduced) {
    return <CheckIcon className="size-3.5" aria-hidden="true" />
  }

  // Render logic
  const draw = { duration: MOTION_MS.layout / 1000, ease: EASE_OUT }

  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <motion.path
        d="M3 8.5l3.2 3.2L13 5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={draw}
      />
    </svg>
  )
}
