'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react'

type RevealProps = {
  children: ReactNode
  /** Stagger step, 0 to 6: each step adds 80 ms before the reveal starts. */
  step?: number
  as?: ElementType
  className?: string
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

/** Fades and rises in once when it scrolls into view. Only opacity and transform animate. */
export default function Reveal({ children, step = 0, as: Tag = 'div', className }: RevealProps) {
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

  return (
    <Tag
      ref={ref}
      data-revealed={revealed}
      className={cn('reveal', DELAY[Math.min(step, 6)], className)}
    >
      {children}
    </Tag>
  )
}
