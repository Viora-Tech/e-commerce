'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useId } from 'react'
import { instant, pill } from '@/lib/motion'

type StatTabsProps = {
  items: { label: string; value: string }[]
  /** Index of the selected tab (controlled). */
  active: number
  onChange: (index: number) => void
}

/** Sheet 14:403: five 78px cells 20px apart, 8/15 inset; 24/22/700 figure over a 13/18/500 caption; the active cell carries a 2px Ocean Green rule (slides between cells) and a 4% green wash, the rest a #e9e7fd hairline. */
export default function StatTabs({ items, active, onChange }: StatTabsProps) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <div
      role="tablist"
      className="grid grid-cols-(--cols) gap-5"
      style={{ '--cols': `repeat(${items.length}, minmax(0, 1fr))` } as CSSProperties}
    >
      {items.map((it, i) => {
        const selected = i === active
        return (
          <button
            key={it.label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(i)}
            className={cn(
              'relative flex h-[4.875rem] flex-col items-start justify-center gap-2 border-b border-border-soft px-2 py-[0.9375rem] text-left transition-colors',
              selected
                ? 'bg-gradient-to-b from-primary/0 to-primary/[0.04]'
                : 'hover:bg-background/60',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`${group}-rule`}
                transition={slide}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                aria-hidden
              />
            ) : null}
            <span className="text-kit-stat-sm text-foreground tabular-nums">{it.value}</span>
            <span className="text-kit-caption text-muted-foreground-soft">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
