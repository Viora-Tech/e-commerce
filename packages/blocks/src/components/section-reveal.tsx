'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { loadMotion } from '../lazy-motion'
import type { EntranceAnimation } from '../section-settings'
import { shouldAnimateEntrance } from '../section-settings'
import { useReducedMotion } from '../use-reduced-motion'

type SectionRevealProps = {
  animation: EntranceAnimation
  className?: string | undefined
  children: ReactNode
}

type Pose = { opacity: number; y?: number; scale?: number }

/** Where each entrance starts; every one ends at opacity 1 and no transform. */
const HIDDEN: Record<Exclude<EntranceAnimation, 'none'>, Pose> = {
  fade: { opacity: 0 },
  'slide-up': { opacity: 0, y: 24 },
  zoom: { opacity: 0, scale: 0.96 },
}

const TRANSITION = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }

/** Only once a sliver of the section is inside the viewport, not at its very edge. */
const MARGIN = '0px 0px -10% 0px'

function hiddenTransform(pose: Pose): string {
  if (pose.y !== undefined) return `translateY(${pose.y}px)`
  if (pose.scale !== undefined) return `scale(${pose.scale})`
  return ''
}

/**
 * A section's `advanced.entranceAnimation`, played once as it scrolls into view.
 * The server HTML is always visible, so the LCP element never waits on script: a
 * section is hidden only if it is still below the fold once the (lazily fetched)
 * animation library is in. Reduced motion disables it. Only `opacity`/`transform`
 * animate, so the element's box never changes size (no layout shift).
 */
export default function SectionReveal({ animation, className, children }: SectionRevealProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !shouldAnimateEntrance(animation, reducedMotion)) return
    const hidden = HIDDEN[animation as Exclude<EntranceAnimation, 'none'>]
    let live = true
    let waiting = false
    let stop: (() => void) | undefined
    loadMotion()
      .then(({ animate, inView }) => {
        if (!live || el.getBoundingClientRect().top < window.innerHeight) return
        el.style.opacity = String(hidden.opacity)
        el.style.transform = hiddenTransform(hidden)
        waiting = true
        stop = inView(
          el,
          () => {
            waiting = false
            animate(
              el,
              {
                opacity: [hidden.opacity, 1],
                ...(hidden.y !== undefined ? { y: [hidden.y, 0] } : {}),
                ...(hidden.scale !== undefined ? { scale: [hidden.scale, 1] } : {}),
              },
              TRANSITION,
            )
          },
          { margin: MARGIN },
        )
      })
      .catch(() => {})
    return () => {
      live = false
      stop?.()
      if (waiting) {
        el.style.opacity = ''
        el.style.transform = ''
      }
    }
  }, [animation, reducedMotion])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
