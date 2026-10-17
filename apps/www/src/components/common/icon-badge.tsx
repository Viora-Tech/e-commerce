'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/gsap'

type IconBadgeProps = { children: ReactNode; className?: string }

const SHAPES = 'path, line, polyline, polygon, circle, ellipse, rect'
const DRAW_MS = 900

/**
 * The square icon tile used on cards. When it scrolls into view the icon's strokes draw in, and
 * when the parent card (any `.group`) is hovered the icon wiggles. Reduced motion shows it as is.
 */
export default function IconBadge({ children, className }: IconBadgeProps) {
  // Hooks
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return
    const shapes = [...element.querySelectorAll<SVGGeometryElement>(SHAPES)]
    const animations = shapes.flatMap((shape) => {
      if (typeof shape.getTotalLength !== 'function') return []
      const length = Math.ceil(shape.getTotalLength())
      if (!length) return []
      const animation = shape.animate(
        [
          { strokeDasharray: `${length}`, strokeDashoffset: length },
          { strokeDasharray: `${length}`, strokeDashoffset: 0 },
        ],
        { duration: DRAW_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' },
      )
      animation.pause()
      return [animation]
    })
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      for (const animation of animations) animation.play()
      observer.disconnect()
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      for (const animation of animations) animation.cancel()
    }
  }, [])

  return (
    <span
      ref={ref}
      className={cn(
        'grid size-10 place-items-center rounded-xl border border-border bg-muted text-foreground',
        className,
      )}
    >
      <span className="group-hover:animate-wiggle grid place-items-center">{children}</span>
    </span>
  )
}
