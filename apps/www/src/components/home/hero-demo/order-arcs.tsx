'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/gsap'

export type ArcPoint = { id: string; x: number; y: number }

type OrderArcsProps = {
  origins: readonly ArcPoint[]
  /** Where every arc lands, beside the headline. */
  target: { x: number; y: number }
}

const TRAVEL_MS = 950
const STAGGER_MS = 90

function curve(from: ArcPoint, to: { x: number; y: number }): string {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const controlX = (from.x + to.x) / 2
  const controlY = Math.min(from.y, to.y) - distance * 0.35
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
}

/**
 * Order arcs: a bright dash shoots along a curved path from each city pin into one point, leaving
 * a faint trail that fades. Coordinates are in the parent's pixels (the hero). Web Animations
 * only: stroke offsets and opacity.
 */
export default function OrderArcs({ origins, target }: OrderArcsProps) {
  // Hooks
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg || prefersReducedMotion()) return
    const animations: Animation[] = []
    svg.querySelectorAll<SVGPathElement>('[data-trail]').forEach((trail, index) => {
      const delay = index * STAGGER_MS
      animations.push(
        trail.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: TRAVEL_MS,
          delay,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          fill: 'both',
        }),
        trail.animate([{ opacity: 0.5 }, { opacity: 0 }], {
          duration: 700,
          delay: delay + TRAVEL_MS + 150,
          fill: 'both',
        }),
      )
    })
    svg.querySelectorAll<SVGPathElement>('[data-head]').forEach((head, index) => {
      animations.push(
        head.animate(
          [
            { strokeDashoffset: 0.08, opacity: 1 },
            { strokeDashoffset: -1, opacity: 1 },
          ],
          {
            duration: TRAVEL_MS,
            delay: index * STAGGER_MS,
            easing: 'cubic-bezier(0.5, 0, 0.2, 1)',
            fill: 'both',
          },
        ),
      )
    })
    const pulse = svg.querySelector<SVGCircleElement>('[data-target]')
    if (pulse) {
      animations.push(
        pulse.animate(
          [
            { opacity: 0, transform: 'scale(0.4)' },
            { opacity: 1, transform: 'scale(1.6)', offset: 0.5 },
            { opacity: 0, transform: 'scale(2.4)' },
          ],
          { duration: 1100, delay: TRAVEL_MS * 0.8, fill: 'both' },
        ),
      )
    }
    return () => {
      for (const animation of animations) animation.cancel()
    }
  }, [])

  return (
    <svg
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
    >
      {origins.map((origin) => {
        const d = curve(origin, target)
        return (
          <g key={origin.id} fill="none" strokeLinecap="round">
            <path
              data-trail
              d={d}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1}
              className="stroke-white/50"
              strokeWidth={1}
            />
            <path
              data-head
              d={d}
              pathLength={1}
              strokeDasharray="0.08 1"
              strokeDashoffset={0.08}
              opacity={0}
              className="stroke-white"
              strokeWidth={2.5}
            />
          </g>
        )
      })}
      <circle
        data-target
        cx={target.x}
        cy={target.y}
        r={6}
        opacity={0}
        className="fill-white/70 [transform-box:fill-box] [transform-origin:center]"
      />
    </svg>
  )
}
