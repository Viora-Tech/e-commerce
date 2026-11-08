'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

type StickyColumnsProps = {
  main: ReactNode
  side?: ReactNode
  /** The grid: its gap and the desktop column template (`lg:grid-cols-[minmax(0,1fr)_20rem]`). */
  className: string
  /** The gap between cards: 1.25rem on the Saleor pages, 1.5rem on the Proofly and order frames. */
  gap?: 5 | 6
  /** `aside` for the side column on the order page; a plain `div` elsewhere. */
  sideAs?: 'div' | 'aside'
}

type Column = 'main' | 'side'

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

/** The sticky offset in px: the top room, or above the screen by what does not fit. */
function offsetFor(height: number, screen: number): number {
  return Math.min(ROOM_PX, screen - height - ROOM_PX)
}

/** A column of cards that keep their full height; the sticky one stays in view on desktop. */
function columnClass(gap: 5 | 6, sticky: boolean): string {
  return cn(
    'flex min-w-0 flex-col *:shrink-0',
    GAP_CLASS[gap],
    sticky && 'lg:sticky lg:top-(--column-top) lg:self-start',
  )
}

/**
 * The two columns of a detail page: a main column and a side column of stacked cards. On desktop
 * the shorter of the two stays in view while the longer one scrolls, so neither leaves an empty
 * stretch beside the other (the customer page's side column runs longer than its main one). The
 * sticky column stays at the top when it fits on the screen; a taller one scrolls with the page
 * until its last card is in view and then stays there, so its cards never slide out of reach.
 * Below 64rem the columns stack, main first, and nothing sticks.
 *
 * Every card keeps its full height (`[&>*]:shrink-0`): cards clip their content, which makes a
 * flex item's minimum height zero, and a height-capped column once squashed them (#671). The
 * column used to cap itself at the screen's height and scroll on its own with a hidden
 * scrollbar, so a column a little taller than the screen slid its cards up under its own top
 * edge when scrolled over (#1057, the inbound shipment page). Now neither column scrolls on its
 * own: which one sticks, and its offset, are measured as the cards and the window change. Page
 * columns, the order frame and the Proofly frame all use this one component, so the rule cannot
 * drift between them.
 */
export default function StickyColumns({
  main,
  side,
  className,
  gap = 5,
  sideAs = 'div',
}: StickyColumnsProps) {
  // Hooks
  const mainRef = useRef<HTMLDivElement>(null)
  /** The side column's node, kept as state so the effect runs again when it mounts. */
  const [sideNode, setSideNode] = useState<HTMLElement | null>(null)
  /** The column that stays in view (the shorter one) and its sticky offset in px. */
  const [stick, setStick] = useState<{ column: Column; top: number }>({
    column: 'side',
    top: ROOM_PX,
  })

  useEffect(() => {
    const mainNode = mainRef.current
    if (!mainNode || !sideNode) return
    const scroller = scrollerOf(sideNode)
    const measure = () => {
      const screen = scroller?.clientHeight ?? window.innerHeight
      // A tie keeps the side column in view, as before.
      const column: Column = mainNode.scrollHeight < sideNode.scrollHeight ? 'main' : 'side'
      const height = column === 'main' ? mainNode.scrollHeight : sideNode.scrollHeight
      const top = offsetFor(height, screen)
      setStick((prev) => (prev.column === column && prev.top === top ? prev : { column, top }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(mainNode)
    observer.observe(sideNode)
    if (scroller) observer.observe(scroller)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [sideNode])

  // Render logic
  const SideTag = sideAs
  const mainSticks = Boolean(side) && stick.column === 'main'
  const sideSticks = stick.column === 'side'
  const topStyle = { '--column-top': `${stick.top / REM_PX}rem` } as CSSProperties

  return (
    <div className={cn('grid grid-cols-1 items-start', className)}>
      <div
        ref={mainRef}
        data-sticky={mainSticks ? '' : undefined}
        style={topStyle}
        className={columnClass(gap, mainSticks)}
      >
        {main}
      </div>
      {side ? (
        <SideTag
          ref={setSideNode}
          data-sticky={sideSticks ? '' : undefined}
          style={topStyle}
          className={columnClass(gap, sideSticks)}
        >
          {side}
        </SideTag>
      ) : null}
    </div>
  )
}
