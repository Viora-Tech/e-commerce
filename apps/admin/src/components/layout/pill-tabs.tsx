'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { instant, pill } from '@/lib/motion'

type PillTab<T extends string | null> = {
  value: T
  label: ReactNode
  /** Muted count after the label, e.g. "240" on the All tab. */
  count?: number
}

type PillTabsProps<T extends string | null> = {
  tabs: PillTab<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
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
    track: 'inline-flex items-center rounded-md border border-border bg-muted p-0.5',
    tab: `relative isolate flex h-7 items-center gap-1 rounded-[0.3125rem] px-2.5 text-body font-medium text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`,
    active: 'text-ink-strong',
    marker: 'absolute inset-0 -z-10 rounded-[0.3125rem] bg-card shadow-lift ring-1 ring-border',
  },
} as const

/** Status tabs for list pages (and a segmented switch); the marker slides to the picked tab (Motion). */
export default function PillTabs<T extends string | null>({
  tabs,
  value,
  onChange,
  className,
  variant = 'underline',
}: PillTabsProps<T>) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()

  // Render logic
  const slide = reduced ? instant : pill
  const s = STYLES[variant]

  return (
    <div role="tablist" className={cn(s.track, className)}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={String(tab.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(s.tab, active && s.active)}
          >
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
                <span
                  className={cn(
                    'rounded-sm px-1 text-caption tabular-nums',
                    active ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {tab.count}
                </span>
              )
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
