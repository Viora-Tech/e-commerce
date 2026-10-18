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
  /** A soft grey light and border glow that follow the cursor over the card (a brighten, no movement). */
  spotlight?: boolean
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
 * Fades and rises in once when it scrolls into view (opacity and a short translate only). With
 * `spotlight` the card also brightens a soft light under the cursor; nothing moves on hover.
 */
export default function Reveal({
  children,
  step = 0,
  as: Tag = 'div',
  className,
  spotlight = false,
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
    if (!element || !spotlight || isCoarsePointer() || prefersReducedMotion()) return
    let frame = 0
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect()
      const px = ((event.clientX - box.left) / box.width) * 100
      const py = ((event.clientY - box.top) / box.height) * 100
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--mx', `${px}%`)
        element.style.setProperty('--my', `${py}%`)
      })
    }
    element.addEventListener('pointermove', move)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', move)
    }
  }, [spotlight])

  return (
    <Tag
      ref={ref}
      data-revealed={revealed}
      className={cn('reveal', DELAY[Math.min(step, 6)], spotlight && 'spotlight', className)}
    >
      {children}
    </Tag>
  )
}
