'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

type SummaryItemsProps = {
  /** The order's lines, one `SummaryLine` each. */
  children: ReactNode
}

/** Pixels from the end that still count as the end, so a rounding gap shows no fade. */
const END_SLACK = 8

const hasMore = (el: HTMLElement): boolean =>
  el.scrollHeight - el.scrollTop - el.clientHeight > END_SLACK

/**
 * The order's lines in the checkout summary. On a desktop a long order scrolls here, with no
 * scrollbar and a soft fade where more lines wait, so the code fields, totals and Pay stay on
 * screen. The top padding sits on this wrapper: the theme resets it on a list, and each
 * thumbnail's quantity badge needs that room. Phones keep the fold-out summary at full height.
 */
export default function SummaryItems({ children }: SummaryItemsProps) {
  // Hooks
  const scroller = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    setMore(hasMore(el))
    const observer = new ResizeObserver(() => setMore(hasMore(el)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Event handlers
  const handleScroll = () => {
    if (scroller.current) setMore(hasMore(scroller.current))
  }

  // Render logic
  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={handleScroll}
        className="pt-2 lg:max-h-[min(17rem,32dvh)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex flex-col gap-4">{children}</ul>
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 hidden h-12 bg-linear-to-t from-ck-summary to-transparent transition-opacity duration-150 ease-out motion-reduce:transition-none lg:block ${more ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
