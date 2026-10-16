'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EASE_OUT } from '@/lib/motion'

type RollingNumberProps = {
  /** The already formatted figure, e.g. "12" or "1.2K". */
  value: string
  className?: string
}

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

/**
 * The live count, rolling per digit when it changes (motion spec 09): each digit slides in
 * its own clipped window, so the figure never jumps or reflows (tabular figures). Still
 * while the tab is hidden (no frames run there; the poll itself only fires when visible).
 */
export default function RollingNumber({ value, className }: RollingNumberProps) {
  // Hooks
  const reduced = useReducedMotion()
  const [pageVisible, setPageVisible] = useState(() => isPageVisible())

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Early returns
  if (reduced || !pageVisible) {
    return <span className={className}>{value}</span>
  }

  // Render logic
  const roll = { duration: 0.2, ease: EASE_OUT }

  return (
    <span className={className} role="status" aria-label={value}>
      {value.split('').map((char, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: digits have no ids; order never changes.
          key={i}
          aria-hidden="true"
          className="inline-flex overflow-hidden align-baseline"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={char}
              initial={{ y: '70%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              exit={{ y: '-70%', opacity: 0 }}
              transition={roll}
              className="inline-block tabular-nums"
            >
              {char === ' ' ? ' ' : char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
