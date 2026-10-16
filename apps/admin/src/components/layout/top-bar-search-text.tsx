'use client'

import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { MOTION_MS } from '@/lib/motion'
import RollingText from './rolling-text'

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

  return (
    <span
      ref={textRef}
      className="flex min-w-0 flex-1 items-center gap-1 text-left text-body text-muted-foreground"
    >
      <span className="shrink-0">{lead}</span>
      <RollingText text={example} className="flex-1 text-foreground/70" />
    </span>
  )
}
