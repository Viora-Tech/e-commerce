'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { layoutContent } from '@/data/layout'
import { useCopy, useFormat } from '@/hooks/use-copy'

type ScrollSectionProps = {
  children: ReactNode
  /** Names the scroll area for screen readers ("Sample records"). */
  label: string
  /** Total rows, for the footer line; omitted means the line just says "scroll for more". */
  count?: number | undefined
  /** CSS max-height of the list before it scrolls. */
  maxHeight?: string
  /** Remembers "Show all" for the session; give each section its own id. */
  id?: string
  /** Sticks to the top of the scroll area (a column row); table headers stick on their own. */
  header?: ReactNode
  className?: string
}

/** Sections the member expanded this session, so they stay open when the page re-renders. */
const expandedIds = new Set<string>()

const EDGE = 4

/** Fades the list into its surface where more is hidden; a mask, so it works on any background. */
function edgeMask(top: boolean, bottom: boolean): string {
  return `linear-gradient(to bottom, ${top ? 'black' : 'transparent'} 0, black ${top ? '0' : '1.5rem'}, black calc(100% - ${bottom ? '0rem' : '2.5rem'}), ${bottom ? 'black' : 'transparent'} 100%)`
}

/**
 * A long list inside a card. Past `maxHeight` it scrolls inside itself (thin scrollbar, sticky
 * header, soft fades at the edges that still have more) instead of stretching the page; a
 * footer offers "Show all". Short content keeps its height and shows none of this. On phones
 * it does not trap the page scroll: the list is clipped with a fade and "Show all" opens it.
 */
export default function ScrollSection({
  children,
  label,
  count,
  maxHeight = 'min(28rem, 60vh)',
  id,
  header,
  className,
}: ScrollSectionProps) {
  // Hooks
  const copy = useCopy(layoutContent.scroll)
  const fmt = useFormat()
  const scroller = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(() => (id ? expandedIds.has(id) : false))
  const [overflowing, setOverflowing] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => {
      // Expanded has no cap to overflow; keep the last capped answer so "Show less" stays.
      if (!expanded) setOverflowing(el.scrollHeight - el.clientHeight > EDGE)
      setAtTop(el.scrollTop <= EDGE)
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - EDGE)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [expanded])

  // Event handlers
  const handleScroll = () => {
    const el = scroller.current
    if (!el) return
    setAtTop(el.scrollTop <= EDGE)
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - EDGE)
  }
  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (!id) return
    if (next) expandedIds.add(id)
    else expandedIds.delete(id)
  }

  // Render logic
  const capped = overflowing && !expanded
  const mask = capped ? edgeMask(atTop, atBottom) : undefined
  const n = count === undefined ? undefined : fmt.number(count)
  const status = expanded
    ? n === undefined
      ? ''
      : copy.showingAll(n)
    : n === undefined
      ? copy.more
      : copy.showing(n)

  return (
    <div className={cn('flex flex-col', className)}>
      <section
        ref={scroller}
        aria-label={label}
        tabIndex={capped ? 0 : undefined}
        onScroll={handleScroll}
        style={expanded ? undefined : { maxHeight, maskImage: mask, WebkitMaskImage: mask }}
        className={cn(
          'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          '[&_[data-slot=table-container]]:overflow-visible',
          '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-card',
          !expanded &&
            'overflow-hidden [scrollbar-width:thin] md:overflow-auto md:overscroll-contain',
        )}
      >
        {header ? <div className="sticky top-0 z-10 bg-card">{header}</div> : null}
        {children}
      </section>
      {overflowing || expanded ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="hidden text-caption text-muted-foreground tabular-nums md:inline">
            {status}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-md:ml-auto"
            aria-expanded={expanded}
            onClick={handleToggle}
          >
            {expanded ? copy.collapse : copy.expand}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
