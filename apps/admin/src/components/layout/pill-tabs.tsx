'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import type { KeyboardEvent, ReactNode } from 'react'
import { useId } from 'react'
import { instant, pill } from '@/lib/motion'

type PillTab<T extends string | null> = {
  value: T
  label: ReactNode
  /** Muted count after the label, e.g. "240" on the All tab. */
  count?: number
  /** A tab that is a link (a server-rendered list's state): it navigates instead of `onChange`. */
  href?: string
  /** The tab's DOM id and the panel it shows, for pages that draw real tab panels. */
  id?: string
  controls?: string
}

type PillTabsProps<T extends string | null> = {
  tabs: PillTab<T>[]
  value: T
  /** Called with the picked tab; link tabs (`href`) navigate instead. */
  onChange?: (value: T) => void
  className?: string
  /** Read out for the strip ("Product sections"). */
  label?: string
  /** Tabs share the width equally (a segmented switch filling a narrow panel). */
  fill?: boolean
  /**
   * Arrow keys move between tabs (the page passes `onKeyDown`): only the open tab is in the Tab
   * order, as the tabs pattern asks.
   */
  roving?: boolean
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  /**
   * `pill` (default): plain text tabs; the active one sits on a light grey pill that
   * slides between tabs. `underline`: tabs marked by a 2px ink rule. `segmented`: a compact
   * neutral switch for ranges.
   */
  variant?: 'pill' | 'underline' | 'segmented'
  /** Kept for older call sites; both sizes draw the same tabs. */
  size?: 'default' | 'frame'
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const STYLES = {
  pill: {
    track: 'inline-flex items-center gap-0.5',
    tab: `relative isolate flex h-8 items-center gap-1.5 rounded-md px-3 text-body whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`,
    active: 'text-ink-strong',
    marker: 'absolute inset-0 -z-10 rounded-md bg-secondary',
  },
  underline: {
    track: 'flex items-center gap-5',
    tab: `relative flex h-11 items-center gap-1.5 whitespace-nowrap text-body font-medium text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`,
    active: 'text-ink-strong',
    marker: 'absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-foreground',
  },
  segmented: {
    track: 'inline-flex items-center gap-0.5 rounded-[0.6875rem] bg-muted p-[0.1875rem]',
    tab: `relative isolate flex h-[1.875rem] items-center gap-1.5 rounded-[0.5rem] px-3 text-body font-medium text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`,
    active: 'font-semibold text-ink-strong',
    marker: 'absolute inset-0 -z-10 rounded-[0.5rem] border border-border bg-card shadow-lift',
  },
} as const

/** Status tabs for list pages (and a segmented switch); the marker slides to the picked tab (Motion). */
export default function PillTabs<T extends string | null>({
  tabs,
  value,
  onChange,
  className,
  label,
  fill = false,
  roving = false,
  onKeyDown,
  variant = 'underline',
}: PillTabsProps<T>) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()

  // Render logic
  const slide = reduced ? instant : pill
  const s = STYLES[variant]

  const links = tabs.some((tab) => tab.href)
  const trackClass = cn(s.track, fill && 'grid auto-cols-fr grid-flow-col', className)

  const items = tabs.map((tab) => {
    const active = tab.value === value
    const body = (
      <>
        {active ? (
          <motion.span
            layoutId={`${group}-marker`}
            transition={slide}
            className={s.marker}
            aria-hidden
          />
        ) : null}
        {tab.label}
        {tab.count != null ? (
          variant === 'pill' ? (
            <span className="text-caption text-muted-foreground tabular-nums">{tab.count}</span>
          ) : (
            // Every count sits in a small pill so the numbers line up as a row; the active
            // tab's is darker and an empty tab's fades, so the busy stages stand out.
            <span
              className={cn(
                'min-w-5 rounded-full px-1.5 text-center text-caption font-medium tabular-nums',
                active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                tab.count === 0 && !active && 'opacity-60',
              )}
            >
              {tab.count}
            </span>
          )
        ) : null}
      </>
    )
    const tabClass = cn(s.tab, fill && 'justify-center', active && s.active)
    return tab.href ? (
      <Link
        key={String(tab.value)}
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={tabClass}
      >
        {body}
      </Link>
    ) : (
      <button
        key={String(tab.value)}
        type="button"
        role="tab"
        id={tab.id}
        aria-selected={active}
        aria-controls={tab.controls}
        tabIndex={roving && !active ? -1 : undefined}
        onClick={() => onChange?.(tab.value)}
        className={tabClass}
      >
        {body}
      </button>
    )
  })

  // Link tabs are site navigation, not a tab widget.
  return links ? (
    <nav aria-label={label} className={trackClass}>
      {items}
    </nav>
  ) : (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={trackClass}>
      {items}
    </div>
  )
}
