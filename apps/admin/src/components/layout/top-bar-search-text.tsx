'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { EASE_OUT, MOTION_MS } from '@/lib/motion'

type TopBarSearchTextProps = {
  /** Hints to roll through while the bar sits idle; the static label when empty. */
  phrases: readonly string[]
  fallback: string
}

/**
 * The top bar's search hint (motion spec 13): rolls through what the merchant can search or
 * ask, old phrase sliding up out of a clipped window while the new one rises in. Stops the
 * moment the button is hovered or focused; under reduced motion the label stays still.
 */
export default function TopBarSearchText({ phrases, fallback }: TopBarSearchTextProps) {
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
    if (reduced || paused || phrases.length === 0) return
    let every: ReturnType<typeof setInterval> | null = null
    const first = setTimeout(() => {
      setAt((n) => n + 1)
      every = setInterval(() => {
        setAt((n) => n + 1)
      }, MOTION_MS.rotateEvery)
    }, MOTION_MS.rotateFirst)
    return () => {
      clearTimeout(first)
      if (every) clearInterval(every)
    }
  }, [reduced, paused, phrases.length])

  // Early returns
  if (reduced || phrases.length === 0) {
    return (
      <span ref={textRef} className="min-w-0 flex-1 truncate text-body text-muted-foreground">
        {fallback}
      </span>
    )
  }

  // Render logic
  const phrase = phrases[at % phrases.length] ?? fallback
  const roll = { duration: MOTION_MS.rollingText / 1000, ease: EASE_OUT }

  return (
    <span
      ref={textRef}
      className="grid min-w-0 flex-1 overflow-hidden text-left text-body text-muted-foreground"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={phrase}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={roll}
          className="truncate [grid-area:1/1]"
        >
          {phrase}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
