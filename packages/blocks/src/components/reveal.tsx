'use client'

import { animate, inView } from 'motion'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useRef } from 'react'
import { REVEAL, remToPx } from '../data/motion'

type RevealProps = { children: ReactNode }

/**
 * Port of Glide's reveal.js: a section fades and rises in the first time it scrolls
 * into view. The server HTML is always visible (no-JS visitors, crawlers and the LCP
 * element never wait on script); only a section still below the fold at hydration is
 * hidden, and only when the visitor has not asked for reduced motion.
 */
export default function Reveal({ children }: RevealProps) {
  // Hooks
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    const rise = remToPx(REVEAL.riseRem)
    el.style.opacity = '0'
    el.style.transform = `translateY(${rise}px)`
    return inView(
      el,
      () => {
        animate(el, { opacity: 1 }, REVEAL.fade)
        animate(el, { y: [rise, 0] }, REVEAL.rise)
      },
      { margin: REVEAL.margin },
    )
  }, [reduce])

  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  )
}
