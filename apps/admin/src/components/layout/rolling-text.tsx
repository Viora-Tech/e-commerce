'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { EASE_OUT, MOTION_MS } from '@/lib/motion'

type RollingTextProps = {
  /** The text shown now; a new value rolls in. */
  text: string
  className?: string | undefined
}

/**
 * One rolling hint for the whole admin (owner, 2026-10-17: the top bar search and Home's Ask AI
 * box move the same way): the old text slides up out of a clipped window while the new one
 * rises in, 600ms on the ease-out curve. Under reduced motion it just swaps.
 */
export default function RollingText({ text, className }: RollingTextProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const roll = { duration: MOTION_MS.searchRoll / 1000, ease: EASE_OUT }

  return (
    <span className={`grid min-w-0 overflow-hidden ${className ?? ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={reduced ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { y: -14, opacity: 0 }}
          transition={roll}
          className="truncate [grid-area:1/1]"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
