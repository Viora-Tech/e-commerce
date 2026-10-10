'use client'

import { type ReactNode, useEffect, useRef } from 'react'

type StickyHeaderProps = {
  sticky: 'none' | 'always' | 'on-scroll-up'
  children: ReactNode
}

/** Past this many pixels of scroll the header takes its "scrolled" look. */
const SCROLLED_PAST_PX = 4

/**
 * The header's wrapper (Zero Drift `<sticky-header>` in header.js). Pinning itself is CSS
 * (`data-sticky-type`, section-header.css); this marks `.scrolled-past` once the page moves
 * and, for "on scroll up", hides the header while scrolling down past it.
 */
export default function StickyHeader({ sticky, children }: StickyHeaderProps) {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      el.classList.toggle('scrolled-past', y > SCROLLED_PAST_PX)
      if (sticky === 'on-scroll-up') {
        el.classList.toggle('header-wrapper--hidden', y > last && y > el.offsetHeight)
      }
      last = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sticky])

  // Render logic
  return (
    <div ref={ref} className="header-wrapper" data-sticky-type={sticky}>
      {children}
    </div>
  )
}
