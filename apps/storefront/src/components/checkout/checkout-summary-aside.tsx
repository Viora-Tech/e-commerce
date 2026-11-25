'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

type CheckoutSummaryAsideProps = { children: ReactNode }

/** 1.5rem above the card when it sticks, and as much room below. */
const GAP_PX = 48

/**
 * The order summary's column from `lg`: sticky while the whole card fits on the screen, and
 * otherwise part of the page, scrolling with it. The card never scrolls inside itself (owner,
 * 26 Nov 2026: on a laptop the title and first product scrolled out of view inside the card).
 */
export default function CheckoutSummaryAside({ children }: CheckoutSummaryAsideProps) {
  // Hooks
  const ref = useRef<HTMLElement>(null)
  const [fits, setFits] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setFits(el.offsetHeight + GAP_PX <= window.innerHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Render logic
  return (
    <aside
      ref={ref}
      className={`lg:col-start-2 lg:row-start-1 lg:self-start ${fits ? 'lg:sticky lg:top-6' : ''}`}
    >
      {children}
    </aside>
  )
}
