'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

type StickySideColumnProps = {
  children: ReactNode
  /** The gap between cards: 1.25rem on the Saleor pages, 1.5rem on the Proofly and order frames. */
  gap?: 5 | 6
  /** `aside` on the order page; a plain `div` elsewhere. */
  as?: 'div' | 'aside'
}

const GAP_CLASS = { 5: 'gap-5', 6: 'gap-6' } as const

/** Room kept above and below the column when it stays in view: 1.5rem each. */
const ROOM_PX = 24
const REM_PX = 16

/** The nearest ancestor that scrolls (the admin's `main`), or the page itself. */
function scrollerOf(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el
  }
  return null
}

/**
 * The right column of a detail page: stacked cards that stay in view on desktop. A column that
 * fits on the screen stays at the top; a taller one scrolls with the page until its last card
 * is in view and then stays there, so its cards never slide out of reach (the order page).
 *
 * Every card keeps its full height (`[&>*]:shrink-0`): cards clip their content, which makes a
 * flex item's minimum height zero, and a height-capped column once squashed them (#671). It
 * used to cap itself at the screen's height and scroll on its own with a hidden scrollbar, so a
 * column a little taller than the screen slid its cards up under its own top edge when scrolled
 * over (#1057, the inbound shipment page). Now it never scrolls on its own: its sticky offset is
 * measured as the cards and the window change. Page columns, the order frame
 * and the Proofly frame all use this one component, so the rule cannot drift between them.
 */
export default function StickySideColumn({ children, gap = 5, as = 'div' }: StickySideColumnProps) {
  // Hooks
  const ref = useRef<HTMLElement>(null)
  /** The sticky offset in px: the top room, or above the screen by what does not fit. */
  const [top, setTop] = useState(ROOM_PX)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const scroller = scrollerOf(node)
    const measure = () => {
      const screen = scroller?.clientHeight ?? window.innerHeight
      setTop(Math.min(ROOM_PX, screen - node.scrollHeight - ROOM_PX))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (scroller) observer.observe(scroller)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Render logic
  const Tag = as

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        ref.current = el
      }}
      style={{ '--side-top': `${top / REM_PX}rem` } as CSSProperties}
      className={cn(
        'flex min-w-0 flex-col *:shrink-0 lg:sticky lg:top-(--side-top) lg:self-start',
        GAP_CLASS[gap],
      )}
    >
      {children}
    </Tag>
  )
}
