'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { instant, pill } from '@/lib/motion'

type PillTab<T extends string | null> = {
  value: T
  label: ReactNode
  /** Muted count after the label, e.g. "(240)" on the All tab. */
  count?: number
}

type PillTabsProps<T extends string | null> = {
  tabs: PillTab<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** `frame`: Dealport 5:2561 sizes (40px track, 32px tabs, kit text). Default is the compact list size. */
  size?: 'default' | 'frame'
}

/* Sheet 14:977: Aqua Spring track with 4px inset and radius 8; the active tab is a white
   radius-6 pill (15/500 black, 14/700 green count) that slides between tabs. */
const TAB =
  'relative isolate flex items-center gap-1 rounded-[0.375rem] font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TAB_SIZE = {
  default: 'h-7 px-2.5 text-xs leading-4',
  frame: 'h-8 px-3 text-kit-cell font-medium text-muted-foreground',
} as const
const COUNT_SIZE = {
  default: 'text-xs font-semibold',
  frame: 'text-kit-body font-bold',
} as const
const TRACK_SIZE = { default: '', frame: 'h-10' } as const
const TAB_ACTIVE = 'text-foreground'

/** Status filter tabs for list pages; the active pill slides to the picked tab. */
export default function PillTabs<T extends string | null>({
  tabs,
  value,
  onChange,
  className,
  size = 'default',
}: PillTabsProps<T>) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center rounded-lg bg-primary-soft p-1',
        TRACK_SIZE[size],
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={String(tab.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(TAB, TAB_SIZE[size], active && TAB_ACTIVE)}
          >
            {active ? (
              <motion.span
                layoutId={`${group}-pill`}
                transition={slide}
                className="absolute inset-0 -z-10 rounded-[0.375rem] bg-card shadow-lift"
                aria-hidden
              />
            ) : null}
            {tab.label}
            {tab.count != null ? (
              <span className={cn(COUNT_SIZE[size], 'text-primary tabular-nums')}>
                ({tab.count})
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
