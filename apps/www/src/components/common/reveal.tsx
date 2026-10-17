'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react'
import { isCoarsePointer, prefersReducedMotion } from '@/lib/gsap'

type RevealProps = {
  children: ReactNode
  /** Stagger step, 0 to 6: each step adds 80 ms before the reveal starts. */
  step?: number
  as?: ElementType
  className?: string
  /** A soft grey light and border glow that follow the cursor over the card. */
  spotlight?: boolean
  /** A gentle 3D tilt toward the cursor (max degrees). */
  tilt?: number
}

const DELAY = [
  '',
  '[--reveal-delay:80ms]',
  '[--reveal-delay:160ms]',
  '[--reveal-delay:240ms]',
  '[--reveal-delay:320ms]',
  '[--reveal-delay:400ms]',
  '[--reveal-delay:480ms]',
]

/**
 * Fades and rises in once when it scrolls into view (opacity and translate only). With
 * `spotlight` and `tilt` it also reacts to the cursor, the shared card behaviour for the bento,
 * pricing, feature and value cards.
 */
export default function Reveal({
  children,
  step = 0,
  as: Tag = 'div',
  className,
  spotlight = false,
  tilt = 0,
}: RevealProps) {
  // Hooks
  const ref = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element || (!spotlight && !tilt) || isCoarsePointer() || prefersReducedMotion()) return
    let frame = 0
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect()
      const px = (event.clientX - box.left) / box.width
      const py = (event.clientY - box.top) / box.height
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (spotlight) {
          element.style.setProperty('--mx', `${px * 100}%`)
          element.style.setProperty('--my', `${py * 100}%`)
        }
        if (tilt) {
          element.style.transform = `perspective(60rem) rotateX(${(0.5 - py) * tilt}deg) rotateY(${(px - 0.5) * tilt}deg)`
        }
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      if (tilt) element.style.transform = ''
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', leave)
    }
  }, [spotlight, tilt])

  return (
    <Tag
      ref={ref}
      data-revealed={revealed}
      className={cn(
        'reveal',
        DELAY[Math.min(step, 6)],
        spotlight && 'spotlight',
        tilt > 0 && 'transition-transform duration-300 ease-(--ease-out) will-change-transform',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
