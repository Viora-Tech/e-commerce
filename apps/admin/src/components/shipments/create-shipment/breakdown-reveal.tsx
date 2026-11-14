'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { base, instant } from '@/lib/motion'

type BreakdownRevealProps = {
  /** The row is picked: its price worked out shows under it. */
  open: boolean
  children: ReactNode
  /** Padding and surface of the shown block (inside the clipped part). */
  className?: string | undefined
}

/**
 * The picked courier's price worked out, growing open under its row while the previous pick's
 * closes over the same 200ms. Before, the old block vanished at once, so every row below it
 * jumped up by its height and the pointer landed on the next row (the hover "jumped" there).
 * Reduced motion: shown and hidden at once. Not animated on first paint.
 */
export default function BreakdownReveal({ open, children, className }: BreakdownRevealProps) {
  // Hooks
  const reduced = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="breakdown"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduced ? instant : base}
          className="overflow-hidden"
        >
          <div className={className}>{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
