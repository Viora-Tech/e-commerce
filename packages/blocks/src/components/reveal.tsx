'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { REVEAL, remToPx } from '../data/motion'
import { loadMotion } from '../lazy-motion'
import { useReducedMotion } from '../use-reduced-motion'

type RevealProps = { children: ReactNode }

/**
 * Port of Glide's reveal.js: a section fades and rises in the first time it scrolls
 * into view. The server HTML is always visible (no-JS visitors, crawlers and the LCP
 * element never wait on script); only a section still below the fold once the
 * animation library has loaded is hidden, and only when the visitor has not asked
 * for reduced motion. The library is fetched after hydration, so it never sits in
 * the page's first-load JS.
 */
export default function Reveal({ children }: RevealProps) {
  // Hooks
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    let stop: (() => void) | undefined
    let live = true
    let waiting = false
    loadMotion()
      .then(({ animate, inView }) => {
        // Scrolled into view while the library loaded: leave it be rather than flash it.
        if (!live || el.getBoundingClientRect().top < window.innerHeight) return
        const rise = remToPx(REVEAL.riseRem)
        el.style.opacity = '0'
        el.style.transform = `translateY(${rise}px)`
        waiting = true
        stop = inView(
          el,
          () => {
            waiting = false
            animate(el, { opacity: 1 }, REVEAL.fade)
            animate(el, { y: [rise, 0] }, REVEAL.rise)
          },
          { margin: REVEAL.margin },
        )
      })
      .catch(() => {})
    return () => {
      live = false
      stop?.()
      // Torn down before it came into view: never leave a section invisible.
      if (waiting) {
        el.style.opacity = ''
        el.style.transform = ''
      }
    }
  }, [reduce])

  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  )
}
