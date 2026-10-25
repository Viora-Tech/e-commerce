'use client'

import { type ElementType, useEffect, useRef } from 'react'
import { loadGsap, prefersReducedMotion } from '@/lib/gsap'

type LineRevealProps = {
  children: string
  as?: ElementType
  className?: string
}

/** Paragraph whose lines slide up one after another when it mounts (GSAP SplitText, lazy). */
export default function LineReveal({ children, as: Tag = 'p', className }: LineRevealProps) {
  // Hooks
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return
    let cancelled = false
    let cleanup = () => {}
    loadGsap().then(({ gsap, SplitText }) => {
      if (cancelled) return
      const split = SplitText.create(element, { type: 'lines', mask: 'lines', aria: 'auto' })
      const tween = gsap.from(split.lines, {
        yPercent: 105,
        opacity: 0,
        duration: 0.7,
        ease: 'expo.out',
        stagger: 0.08,
        delay: 0.15,
      })
      cleanup = () => {
        tween.kill()
        split.revert()
      }
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}
