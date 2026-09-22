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
}

/* Frame 5:2561: soft-green track with 4px inset; the active tab is a white 6px pill
   that slides between tabs (shared layout element per tab group). */
const TAB =
  'relative isolate flex h-7 items-center gap-1 rounded-[0.375rem] px-2.5 text-xs font-medium leading-4 text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TAB_ACTIVE = 'text-foreground'

/** Status filter tabs for list pages; the active pill slides to the picked tab. */
export default function PillTabs<T extends string | null>({
  tabs,
  value,
  onChange,
  className,
}: PillTabsProps<T>) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <div
      role="tablist"
      className={cn('flex items-center rounded-lg bg-primary-soft p-1', className)}
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
            className={cn(TAB, active && TAB_ACTIVE)}
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
              <span className="text-xs font-semibold text-primary tabular-nums">({tab.count})</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
