'use client'

import { cn } from '@commerce/ui/lib/utils'

type StatTabsProps = {
  items: { label: string; value: string }[]
  active?: number
  onChange?: (index: number) => void
}

/** Sheet 14:403: five 78px cells 20px apart, 8/15 inset; 24/22/700 figure over a 13/18/500 caption; the active cell carries a 2px Ocean Green rule and a 4% green wash, the rest a #e9e7fd hairline. */
export default function StatTabs({ items, active = 0, onChange }: StatTabsProps) {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it, i) => (
        <button
          key={it.label}
          type="button"
          onClick={onChange ? () => onChange(i) : undefined}
          className={cn(
            'flex h-[4.875rem] flex-col items-start justify-center gap-2 px-2 py-[0.9375rem] text-left transition-colors',
            i === active
              ? 'border-b-2 border-primary bg-gradient-to-b from-primary/0 to-primary/[0.04]'
              : 'border-b border-border-soft hover:bg-background/60',
          )}
        >
          <span className="text-kit-stat-sm text-foreground tabular-nums">{it.value}</span>
          <span className="text-kit-caption text-muted-foreground-soft">{it.label}</span>
        </button>
      ))}
    </div>
  )
}
