'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { EASE_OUT, MOTION_MS } from '@/lib/motion'

type TopBarSearchTextProps = {
  /** The fixed start of the hint ("Search or ask AI"). */
  lead: string
  /** Examples that take turns after it while the bar sits idle. */
  examples: readonly string[]
}

/**
 * The top bar's search hint (owner, 2026-10-17): "Search or ask AI" stays put and only the
 * example after it changes, slowly, the old one sliding up out of a clipped window while the
 * next rises in. Pauses while the button is hovered or focused; under reduced motion the first
 * example stays still.
 */
export default function TopBarSearchText({ lead, examples }: TopBarSearchTextProps) {
  // Hooks
  const reduced = useReducedMotion()
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const button = textRef.current?.closest('button')
    if (!button) return
    const hold = () => setPaused(true)
    const release = () => setPaused(false)
    button.addEventListener('mouseenter', hold)
    button.addEventListener('mouseleave', release)
    button.addEventListener('focusin', hold)
    button.addEventListener('focusout', release)
    return () => {
      button.removeEventListener('mouseenter', hold)
      button.removeEventListener('mouseleave', release)
      button.removeEventListener('focusin', hold)
      button.removeEventListener('focusout', release)
    }
  }, [])

  useEffect(() => {
    if (reduced || paused || examples.length < 2) return
    const every = setInterval(() => setAt((n) => n + 1), MOTION_MS.searchRotateEvery)
    return () => clearInterval(every)
  }, [reduced, paused, examples.length])

  // Render logic
  const example = examples[at % Math.max(1, examples.length)] ?? ''
  const roll = { duration: MOTION_MS.searchRoll / 1000, ease: EASE_OUT }

  return (
    <span
      ref={textRef}
      className="flex min-w-0 flex-1 items-center gap-1 text-left text-body text-muted-foreground"
    >
      <span className="shrink-0">{lead}</span>
      <span className="grid min-w-0 flex-1 overflow-hidden text-foreground/70">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={example}
            initial={reduced ? false : { y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: -14, opacity: 0 }}
            transition={roll}
            className="truncate [grid-area:1/1]"
          >
            {example}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  )
}
