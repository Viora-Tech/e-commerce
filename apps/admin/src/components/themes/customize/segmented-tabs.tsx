'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type SegmentedTabsProps<T extends string> = {
  tabs: readonly T[]
  value: T
  onChange: (next: T) => void
  label: string
  /** Each tab's text, and anything beside it (a count). */
  render: (id: T) => ReactNode
  /** Button height: `sm` for the left panel, `md` for the inspector. */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * The editor's equal-width segmented switch ("Sections | Audit", "Basic | Advanced"). One
 * highlight slides under the active tab instead of jumping, so the change reads as a move.
 */
export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  render,
  size = 'sm',
  className,
}: SegmentedTabsProps<T>) {
  // Render logic
  const index = Math.max(0, tabs.indexOf(value))

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('relative grid gap-0.5 rounded-lg bg-muted p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {/* The highlight: one tab wide, moved by its own width per step (translateX % is of
          itself), plus the 2px gap between tabs. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md bg-card shadow-card transition-transform duration-[var(--duration-dropdown)] ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.25rem - ${tabs.length - 1} * 0.125rem) / ${tabs.length})`,
          transform: `translateX(calc(${index} * (100% + 0.125rem)))`,
        }}
      />
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'relative flex items-center justify-center gap-1.5 rounded-md text-xs leading-[1.0625rem] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
            size === 'sm' ? 'h-7' : 'h-8',
            value === id && 'text-foreground',
          )}
        >
          {render(id)}
        </button>
      ))}
    </div>
  )
}
