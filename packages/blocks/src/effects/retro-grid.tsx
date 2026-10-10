'use client'

// Adapted from Magic UI Retro Grid (MIT), https://magicui.design/docs/components/retro-grid.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
// Changes: the CSS version only (no WebGL canvas), lines in the theme's ink, thinned, and the
// fade in its `--color-bg` so every colour scheme and dark mode follow, the scroll driven by
// Motion after hydration, and it stays still under reduced motion.
import { useEffect, useRef } from 'react'
import { loadMotion } from '../lazy-motion'
import { useReducedMotion } from '../use-reduced-motion'

type RetroGridProps = {
  /** Degrees the floor tilts away from the viewer. */
  angle?: number | undefined
  /** Grid cell size in rem. */
  cellRem?: number | undefined
  /** 0 to 1. */
  opacity?: number | undefined
}

/** The scheme's ink, thinned: visible on light and dark schemes alike, never a fixed colour. */
const LINE = 'color-mix(in oklab,var(--color-ink) 22%,transparent)'
const LINES = `linear-gradient(to right,${LINE} 1px,transparent 0),linear-gradient(to bottom,${LINE} 1px,transparent 0)`
/** Seconds the floor takes to travel one loop. */
const LOOP_SECONDS = 15

/** A perspective grid floor that scrolls slowly toward the viewer, behind a section's content. */
export default function RetroGrid({ angle = 65, cellRem = 3.75, opacity = 0.6 }: RetroGridProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const floor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = floor.current
    if (!el || reducedMotion) return
    let live = true
    let run: { stop(): void } | undefined
    loadMotion()
      .then(({ animate }) => {
        if (!live) return
        run = animate(
          el,
          { y: ['-50%', '0%'] },
          { duration: LOOP_SECONDS, repeat: Infinity, ease: 'linear' },
        )
      })
      .catch(() => {})
    return () => {
      live = false
      run?.stop()
    }
  }, [reducedMotion])

  // Render logic
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden [perspective:12.5rem]"
      style={{ opacity }}
    >
      <div className="absolute inset-0" style={{ transform: `rotateX(${angle}deg)` }}>
        <div
          ref={floor}
          className="absolute inset-[0%_0rem] ml-[-200%] h-[300vh] w-[600vw] origin-[100%_0_0]"
          style={{
            backgroundImage: LINES,
            backgroundSize: `${cellRem}rem ${cellRem}rem`,
            transform: 'translateY(-50%)',
          }}
        />
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-[var(--color-bg)] to-transparent to-90%" />
    </div>
  )
}
